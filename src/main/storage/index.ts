import type { StorageProvider } from './contracts'
import { store } from '../store'
import {
  createMarkdownStorageProvider,
  startMarkdownWatcher,
  stopMarkdownWatcher,
} from './providers/markdown'
import { sqliteStorageProvider } from './providers/sqlite'

const markdownStorageProvider = createMarkdownStorageProvider()

function resolveProvider(engine: string): StorageProvider {
  const syncMode = store.preferences.get('storage.syncMode') as string

  if (engine === 'markdown') {
    if (syncMode === 'realtime') {
      startMarkdownWatcher()
    }
    else {
      stopMarkdownWatcher()
    }

    return markdownStorageProvider
  }

  stopMarkdownWatcher()

  return sqliteStorageProvider
}

export function useStorage(): StorageProvider {
  const engine = store.preferences.get('storage.engine') as string

  return resolveProvider(engine)
}
