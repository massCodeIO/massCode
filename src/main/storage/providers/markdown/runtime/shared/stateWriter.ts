import path from 'node:path'
import fs from 'fs-extra'
import { log } from '../../../../../utils'
import { enqueueCloudDownload } from '../../cloudDownloads'
import {
  pendingStateWriteByPath,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from '../cache'
import { STATE_WRITE_DEBOUNCE_MS } from '../constants'
import { rememberAppFileChange } from './appChanges'
import { getFileAvailability, markAppWrittenFileAsLocal } from './cloudFiles'

const CLOUD_STATE_FLUSH_RETRY_MS = 5_000

export interface StateFlushResult {
  errors: { error: unknown, statePath: string }[]
  unresolvedPaths: string[]
}

function clearStateFlushTimer(statePath: string): void {
  const timer = stateFlushTimerByPath.get(statePath)
  if (!timer) {
    return
  }

  clearTimeout(timer)
  stateFlushTimerByPath.delete(statePath)
}

function replaceStateFlushTimer(statePath: string, delay: number): void {
  clearStateFlushTimer(statePath)

  const timer = setTimeout(() => {
    if (stateFlushTimerByPath.get(statePath) === timer) {
      stateFlushTimerByPath.delete(statePath)
    }

    try {
      flushPath(statePath)
    }
    catch {
      // flushPath logs the error, preserves pending and schedules the retry.
    }
  }, delay)
  stateFlushTimerByPath.set(statePath, timer)
}

function getPersistedContent(statePath: string): string {
  const cached = stateContentCacheByPath.get(statePath)
  if (cached !== undefined) {
    return cached
  }

  const availability = getFileAvailability(statePath)

  // Плейсхолдер не читается и не кэшируется: сравнение с пустой строкой
  // оставит запись в pending, а flushPath не станет писать до докачки.
  if (availability.isCloudPlaceholder) {
    return ''
  }

  const content = availability.exists ? fs.readFileSync(statePath, 'utf8') : ''

  stateContentCacheByPath.set(statePath, content)
  return content
}

function flushPath(statePath: string): void {
  const pendingContent = pendingStateWriteByPath.get(statePath)
  if (pendingContent === undefined)
    return

  // State-файл вытеснен в облако: запись затёрла бы недокачанную версию.
  // Запись остаётся в pending и повторяется после докачки.
  if (getFileAvailability(statePath).isCloudPlaceholder) {
    enqueueCloudDownload(statePath)
    replaceStateFlushTimer(statePath, CLOUD_STATE_FLUSH_RETRY_MS)
    return
  }

  try {
    const persistedContent = getPersistedContent(statePath)
    if (persistedContent !== pendingContent) {
      fs.ensureDirSync(path.dirname(statePath))
      fs.writeFileSync(statePath, pendingContent, 'utf8')
      rememberAppFileChange(statePath)
      markAppWrittenFileAsLocal(statePath)
    }
  }
  catch (error) {
    replaceStateFlushTimer(statePath, CLOUD_STATE_FLUSH_RETRY_MS)
    log(`storage:markdown:state-flush:${statePath}`, error)
    throw error
  }

  clearStateFlushTimer(statePath)
  stateContentCacheByPath.set(statePath, pendingContent)
  pendingStateWriteByPath.delete(statePath)
}

export function scheduleStateFlush(
  statePath: string,
  content: string,
  options?: { immediate?: boolean },
): void {
  const pendingContent = pendingStateWriteByPath.get(statePath)
  if (pendingContent === content)
    return

  const persistedContent = getPersistedContent(statePath)
  if (persistedContent === content && pendingContent === undefined)
    return

  pendingStateWriteByPath.set(statePath, content)

  if (options?.immediate) {
    flushPath(statePath)
    return
  }

  replaceStateFlushTimer(statePath, STATE_WRITE_DEBOUNCE_MS)
}

export function flushPendingStateWriteByPath(statePath: string): void {
  flushPath(statePath)
}

export function flushPendingStateWrites(): StateFlushResult {
  const paths = [...pendingStateWriteByPath.keys()]
  const errors: StateFlushResult['errors'] = []

  for (const statePath of paths) {
    try {
      flushPath(statePath)
    }
    catch (error) {
      errors.push({ error, statePath })
    }
  }

  return {
    errors,
    unresolvedPaths: paths.filter(statePath =>
      pendingStateWriteByPath.has(statePath),
    ),
  }
}

export function flushPendingStateWritesOrThrow(): void {
  const result = flushPendingStateWrites()
  if (!result.errors.length && !result.unresolvedPaths.length) {
    return
  }

  const affectedPaths = [
    ...new Set([
      ...result.unresolvedPaths,
      ...result.errors.map(entry => entry.statePath),
    ]),
  ]
  const error = new Error(
    `Pending state writes remain for: ${affectedPaths.join(', ')}`,
  )
  if (result.errors.length) {
    error.cause = new AggregateError(
      result.errors.map(entry => entry.error),
      'Failed to flush pending state writes',
    )
  }
  throw error
}

export function resetStateWriter(): void {
  for (const timer of stateFlushTimerByPath.values()) {
    clearTimeout(timer)
  }

  pendingStateWriteByPath.clear()
  stateContentCacheByPath.clear()
  stateFlushTimerByPath.clear()
}
