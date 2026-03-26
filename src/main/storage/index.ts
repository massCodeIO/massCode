import type { NotesStorageProvider, StorageProvider } from './contracts'
import {
  createMarkdownStorageProvider,
  startMarkdownWatcher,
  stopMarkdownWatcher,
} from './providers/markdown'
import { createNotesStorageProvider } from './providers/markdown/notes'

const markdownStorageProvider = createMarkdownStorageProvider()
const notesStorageProvider = createNotesStorageProvider()

export function useStorage(): StorageProvider {
  return markdownStorageProvider
}

export function useNotesStorage(): NotesStorageProvider {
  return notesStorageProvider
}

export { startMarkdownWatcher, stopMarkdownWatcher }
