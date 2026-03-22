import fs from 'fs-extra'
import yaml from 'js-yaml'
import { pendingStateWriteByPath, stateContentCacheByPath } from './cache'
import { scheduleStateFlush } from './shared/stateWriter'

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

export function writeSpaceState(statePath: string, data: unknown): void {
  const content = serializeToYaml(data)
  scheduleStateFlush(statePath, content)
}

export function writeSpaceStateImmediate(
  statePath: string,
  data: unknown,
): void {
  const content = serializeToYaml(data)
  scheduleStateFlush(statePath, content, { immediate: true })
}
