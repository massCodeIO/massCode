import type { NotesStorageProvider, StorageProvider } from './contracts'
import { store } from '../store'
import {
  createMarkdownStorageProvider,
  startMarkdownWatcher,
  stopMarkdownWatcher,
} from './providers/markdown'
import { createNotesStorageProvider } from './providers/markdown/notes'
import { sqliteStorageProvider } from './providers/sqlite'

const markdownStorageProvider = createMarkdownStorageProvider()
const notesStorageProvider = createNotesStorageProvider()
let resolvedEngine: string | null = null
let resolvedProvider: StorageProvider | null = null

function resolveProvider(engine: string): StorageProvider {
  if (resolvedProvider && resolvedEngine === engine) {
    return resolvedProvider
  }

  if (engine === 'markdown') {
    startMarkdownWatcher()

    resolvedEngine = engine
    resolvedProvider = markdownStorageProvider

    return resolvedProvider
  }

  stopMarkdownWatcher()

  resolvedEngine = engine
  resolvedProvider = sqliteStorageProvider

  return resolvedProvider
}

export function useStorage(): StorageProvider {
  const engine = store.preferences.get('storage.engine') as string

  return resolveProvider(engine)
}

export function useNotesStorage(): NotesStorageProvider {
  return notesStorageProvider
}
