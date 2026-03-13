import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import {
  pendingStateWriteByPath,
  STATE_WRITE_DEBOUNCE_MS,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from './constants'

export function readSpaceState<T>(statePath: string): T | null {
  const pending = pendingStateWriteByPath.get(statePath)
  if (pending !== undefined) {
    try {
      const parsed = yaml.load(pending)
      return parsed && typeof parsed === 'object' ? (parsed as T) : null
    }
    catch {
      return null
    }
  }

  const cached = stateContentCacheByPath.get(statePath)
  if (cached !== undefined) {
    try {
      const parsed = yaml.load(cached)
      return parsed && typeof parsed === 'object' ? (parsed as T) : null
    }
    catch {
      return null
    }
  }

  if (!fs.pathExistsSync(statePath)) {
    return null
  }

  try {
    const content = fs.readFileSync(statePath, 'utf8')
    stateContentCacheByPath.set(statePath, content)
    const parsed = yaml.load(content)
    return parsed && typeof parsed === 'object' ? (parsed as T) : null
  }
  catch {
    return null
  }
}

function serializeToYaml(data: unknown): string {
  return yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  })
}

function flushSpaceStateWrite(statePath: string): void {
  const pendingContent = pendingStateWriteByPath.get(statePath)
  if (pendingContent === undefined) {
    return
  }

  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
    stateFlushTimerByPath.delete(statePath)
  }

  const cached = stateContentCacheByPath.get(statePath)
  if (cached !== pendingContent) {
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, pendingContent, 'utf8')
  }

  stateContentCacheByPath.set(statePath, pendingContent)
  pendingStateWriteByPath.delete(statePath)
}

function scheduleSpaceStateFlush(statePath: string): void {
  const existing = stateFlushTimerByPath.get(statePath)
  if (existing) {
    clearTimeout(existing)
  }

  const timer = setTimeout(
    () => flushSpaceStateWrite(statePath),
    STATE_WRITE_DEBOUNCE_MS,
  )
  stateFlushTimerByPath.set(statePath, timer)
}

export function writeSpaceState(statePath: string, data: unknown): void {
  const content = serializeToYaml(data)
  pendingStateWriteByPath.set(statePath, content)
  scheduleSpaceStateFlush(statePath)
}

export function writeSpaceStateImmediate(
  statePath: string,
  data: unknown,
): void {
  const content = serializeToYaml(data)
  pendingStateWriteByPath.set(statePath, content)
  flushSpaceStateWrite(statePath)
}
