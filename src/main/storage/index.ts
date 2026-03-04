import type { StorageProvider } from './contracts'
import { store } from '../store'
import {
  createMarkdownStorageProvider,
  startMarkdownWatcher,
  stopMarkdownWatcher,
} from './providers/markdown'
import { sqliteStorageProvider } from './providers/sqlite'

const markdownStorageProvider = createMarkdownStorageProvider()
let resolvedEngine: string | null = null
let resolvedSyncMode: string | null = null
let resolvedProvider: StorageProvider | null = null

function resolveProvider(engine: string): StorageProvider {
  const syncMode = store.preferences.get('storage.syncMode') as string

  if (
    resolvedProvider
    && resolvedEngine === engine
    && resolvedSyncMode === syncMode
  ) {
    return resolvedProvider
  }

  if (engine === 'markdown') {
    if (syncMode === 'realtime') {
      startMarkdownWatcher()
    }
    else {
      stopMarkdownWatcher()
    }

    resolvedEngine = engine
    resolvedSyncMode = syncMode
    resolvedProvider = markdownStorageProvider

    return resolvedProvider
  }

  stopMarkdownWatcher()

  resolvedEngine = engine
  resolvedSyncMode = syncMode
  resolvedProvider = sqliteStorageProvider

  return resolvedProvider
}

export function useStorage(): StorageProvider {
  const engine = store.preferences.get('storage.engine') as string

  return resolveProvider(engine)
}
