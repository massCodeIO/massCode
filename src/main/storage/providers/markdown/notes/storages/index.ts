import type { NotesStorageProvider } from '../../../../contracts'
import { createNotesFoldersStorage } from './folders'
import { createNotesNotesStorage } from './notes'
import { createNoteTagsStorage } from './tags'

export function createNotesStorageProvider(): NotesStorageProvider {
  return {
    folders: createNotesFoldersStorage(),
    notes: createNotesNotesStorage(),
    tags: createNoteTagsStorage(),
  }
}
