import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import { enqueueCloudDownload } from '../../cloudDownloads'
import {
  pendingStateWriteByPath,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from '../cache'
import { STATE_WRITE_DEBOUNCE_MS } from '../constants'
import { rememberAppFileChange } from './appChanges'
import { getFileAvailability } from './cloudFiles'

const CLOUD_STATE_FLUSH_RETRY_MS = 5_000

let hooksRegistered = false

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

  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
    stateFlushTimerByPath.delete(statePath)
  }

  // State-файл вытеснен в облако: запись затёрла бы недокачанную версию.
  // Запись остаётся в pending и повторяется после докачки.
  if (getFileAvailability(statePath).isCloudPlaceholder) {
    enqueueCloudDownload(statePath)
    const retryTimer = setTimeout(
      () => flushPath(statePath),
      CLOUD_STATE_FLUSH_RETRY_MS,
    )
    stateFlushTimerByPath.set(statePath, retryTimer)
    return
  }

  const persistedContent = getPersistedContent(statePath)
  if (persistedContent !== pendingContent) {
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, pendingContent, 'utf8')
    rememberAppFileChange(statePath)
  }

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

  const existing = stateFlushTimerByPath.get(statePath)
  if (existing)
    clearTimeout(existing)

  const timer = setTimeout(() => flushPath(statePath), STATE_WRITE_DEBOUNCE_MS)
  stateFlushTimerByPath.set(statePath, timer)
}

export function flushPendingStateWriteByPath(statePath: string): void {
  flushPath(statePath)
}

export function flushPendingStateWrites(): void {
  const paths = [...pendingStateWriteByPath.keys()]
  paths.forEach(statePath => flushPath(statePath))
}

export function registerStateWriteHooks(): void {
  if (hooksRegistered)
    return
  hooksRegistered = true
  process.once('beforeExit', flushPendingStateWrites)
  process.once('exit', flushPendingStateWrites)
}
