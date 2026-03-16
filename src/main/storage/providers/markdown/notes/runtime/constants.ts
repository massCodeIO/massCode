import type { NotesRuntimeCache } from './types'
import path from 'node:path'
import {
  INBOX_DIR_NAME,
  META_DIR_NAME,
  META_FILE_NAME,
  SPACES_DIR_NAME,
  TRASH_DIR_NAME,
} from '../../runtime/constants'

export { INBOX_DIR_NAME, META_DIR_NAME, META_FILE_NAME, TRASH_DIR_NAME }

export const NOTES_SPACE_ID = 'notes'

export const NOTES_INBOX_RELATIVE_PATH = `${META_DIR_NAME}/${INBOX_DIR_NAME}`
export const NOTES_TRASH_RELATIVE_PATH = `${META_DIR_NAME}/${TRASH_DIR_NAME}`

export const NOTES_RESERVED_ROOT_NAMES = new Set([
  INBOX_DIR_NAME,
  TRASH_DIR_NAME,
])

export const notesRuntimeRef: { cache: NotesRuntimeCache | null } = {
  cache: null,
}

export function getNotesPaths(vaultPath: string) {
  const notesRoot = path.join(vaultPath, SPACES_DIR_NAME, NOTES_SPACE_ID)
  const metaDirPath = path.join(notesRoot, META_DIR_NAME)

  return {
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    metaDirPath,
    notesRoot,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
  }
}

export function peekNotesRuntimeCache(): NotesRuntimeCache | null {
  return notesRuntimeRef.cache
}
