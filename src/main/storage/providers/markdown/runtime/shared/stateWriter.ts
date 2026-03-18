import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import {
  pendingStateWriteByPath,
  STATE_WRITE_DEBOUNCE_MS,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from '../constants'

let hooksRegistered = false

function getPersistedContent(statePath: string): string {
  const cached = stateContentCacheByPath.get(statePath)
  if (cached !== undefined) {
    return cached
  }

  const content = fs.pathExistsSync(statePath)
    ? fs.readFileSync(statePath, 'utf8')
    : ''

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

  const persistedContent = getPersistedContent(statePath)
  if (persistedContent !== pendingContent) {
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, pendingContent, 'utf8')
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
