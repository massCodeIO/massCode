import type { NotesPaths, NotesRuntimeCache } from './types'
import path from 'node:path'
import fs from 'fs-extra'
import {
  CODE_SPACE_ID,
  INBOX_DIR_NAME,
  META_DIR_NAME,
  META_FILE_NAME,
  NOTES_SPACE_ID,
  STATE_FILE_NAME,
  TRASH_DIR_NAME,
} from '../../runtime/constants'
import { getSpaceDirPath } from '../../runtime/spaces'

export { INBOX_DIR_NAME, META_DIR_NAME, META_FILE_NAME, TRASH_DIR_NAME }

export const NOTES_INBOX_RELATIVE_PATH = `${META_DIR_NAME}/${INBOX_DIR_NAME}`
export const NOTES_TRASH_RELATIVE_PATH = `${META_DIR_NAME}/${TRASH_DIR_NAME}`
export const NOTES_ASSETS_DIR_NAME = 'assets'
export const NOTES_ASSETS_RELATIVE_PATH = `${META_DIR_NAME}/${NOTES_ASSETS_DIR_NAME}`
export const NOTES_LEGACY_ASSETS_RELATIVE_PATH = NOTES_ASSETS_DIR_NAME

export const NOTES_RESERVED_ROOT_NAMES = new Set([
  INBOX_DIR_NAME,
  TRASH_DIR_NAME,
])

export const notesRuntimeRef: { cache: NotesRuntimeCache | null } = {
  cache: null,
}

function getLegacyNestedNotesRoot(vaultPath: string): string {
  return path.join(vaultPath, CODE_SPACE_ID, '__spaces__', NOTES_SPACE_ID)
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

// Legacy layout migration checks run fs calls on every invocation, so
// resolved paths are memoized per vault path. The cache is reset on vault
// re-watch (stopMarkdownWatcher) and via resetNotesPathsCache().
const notesPathsCacheByVaultPath = new Map<string, NotesPaths>()

export function getNotesPaths(vaultPath: string): NotesPaths {
  const cachedPaths = notesPathsCacheByVaultPath.get(vaultPath)
  if (cachedPaths) {
    return cachedPaths
  }

  const notesRoot = getSpaceDirPath(vaultPath, NOTES_SPACE_ID)
  migrateNestedNotesSpace(vaultPath, notesRoot)
  const metaDirPath = path.join(notesRoot, META_DIR_NAME)

  const notesPaths: NotesPaths = {
    assetsPath: path.join(metaDirPath, NOTES_ASSETS_DIR_NAME),
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    legacyAssetsPath: path.join(notesRoot, NOTES_ASSETS_DIR_NAME),
    metaDirPath,
    notesRoot,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
  }

  notesPathsCacheByVaultPath.set(vaultPath, notesPaths)
  return notesPaths
}

export function resetNotesPathsCache(): void {
  notesPathsCacheByVaultPath.clear()
}

export function peekNotesRuntimeCache(): NotesRuntimeCache | null {
  return notesRuntimeRef.cache
}
