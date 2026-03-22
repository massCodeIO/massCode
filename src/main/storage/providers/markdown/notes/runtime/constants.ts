import type { NotesRuntimeCache } from './types'
import path from 'node:path'
import fs from 'fs-extra'
import {
  CODE_SPACE_ID,
  INBOX_DIR_NAME,
  META_DIR_NAME,
  META_FILE_NAME,
  SPACES_DIR_NAME,
  STATE_FILE_NAME,
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

function getLegacyNestedNotesRoot(vaultPath: string): string {
  return path.join(
    vaultPath,
    SPACES_DIR_NAME,
    CODE_SPACE_ID,
    SPACES_DIR_NAME,
    NOTES_SPACE_ID,
  )
}

function hasNotesState(notesRoot: string): boolean {
  return fs.pathExistsSync(
    path.join(notesRoot, META_DIR_NAME, STATE_FILE_NAME),
  )
}

function migrateNestedNotesSpace(vaultPath: string, notesRoot: string): void {
  const legacyNotesRoot = getLegacyNestedNotesRoot(vaultPath)
  if (!fs.pathExistsSync(legacyNotesRoot)) {
    return
  }

  const shouldMerge = fs.pathExistsSync(notesRoot) && hasNotesState(notesRoot)
  if (!shouldMerge) {
    fs.ensureDirSync(path.dirname(notesRoot))
    if (!fs.pathExistsSync(notesRoot)) {
      fs.moveSync(legacyNotesRoot, notesRoot, { overwrite: false })
      return
    }
  }

  fs.copySync(legacyNotesRoot, notesRoot, {
    errorOnExist: false,
    overwrite: false,
  })
  fs.removeSync(legacyNotesRoot)
}

export function getNotesPaths(vaultPath: string) {
  const notesRoot = path.join(vaultPath, SPACES_DIR_NAME, NOTES_SPACE_ID)
  migrateNestedNotesSpace(vaultPath, notesRoot)
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
