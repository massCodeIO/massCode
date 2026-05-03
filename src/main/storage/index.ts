import type {
  HttpStorageProvider,
  NotesStorageProvider,
  StorageProvider,
} from './contracts'
import {
  createMarkdownStorageProvider,
  startMarkdownWatcher,
  stopMarkdownWatcher,
} from './providers/markdown'
import { createHttpStorageProvider } from './providers/markdown/http'
import { createNotesStorageProvider } from './providers/markdown/notes'

const markdownStorageProvider = createMarkdownStorageProvider()
const notesStorageProvider = createNotesStorageProvider()
const httpStorageProvider = createHttpStorageProvider()

export function useStorage(): StorageProvider {
  return markdownStorageProvider
}

export function useNotesStorage(): NotesStorageProvider {
  return notesStorageProvider
}

export function useHttpStorage(): HttpStorageProvider {
  return httpStorageProvider
}

export { startMarkdownWatcher, stopMarkdownWatcher }
