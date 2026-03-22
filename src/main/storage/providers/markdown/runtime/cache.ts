import type { MarkdownRuntimeCache } from './types'

// Shared mutable state (singleton for Electron main process)
// Using an object so mutations are visible across all importers.
export const runtimeRef: { cache: MarkdownRuntimeCache | null } = {
  cache: null,
}

export const pendingStateWriteByPath = new Map<string, string>()
export const stateContentCacheByPath = new Map<string, string>()
export const stateFlushTimerByPath = new Map<string, NodeJS.Timeout>()

export function peekRuntimeCache(): MarkdownRuntimeCache | null {
  return runtimeRef.cache
}
