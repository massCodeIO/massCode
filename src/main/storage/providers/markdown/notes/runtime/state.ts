import type {
  NotesFolderUIState,
  NotesPaths,
  NotesState,
  NotesStateFile,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import {
  pendingStateWriteByPath,
  STATE_WRITE_DEBOUNCE_MS,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from '../../runtime/constants'
import {
  normalizeFlag,
  normalizeFolderUiState,
} from '../../runtime/normalizers'

export function createDefaultNotesState(): NotesState {
  return {
    counters: {
      folderId: 0,
      noteId: 0,
      tagId: 0,
    },
    folderUi: {},
    folders: [],
    notes: [],
    tags: [],
    version: 1,
  }
}

export function syncNotesFolderUiWithFolders(state: NotesState): void {
  const nextFolderUi: Record<string, NotesFolderUIState> = {}

  state.folders.forEach((folder) => {
    const isOpen = normalizeFlag(folder.isOpen)
    folder.isOpen = isOpen
    nextFolderUi[String(folder.id)] = { isOpen }
  })

  state.folderUi = nextFolderUi
}

function getPersistedStateContent(statePath: string): string {
  const cachedStateContent = stateContentCacheByPath.get(statePath)
  if (cachedStateContent !== undefined) {
    return cachedStateContent
  }

  const persistedStateContent = fs.pathExistsSync(statePath)
    ? fs.readFileSync(statePath, 'utf8')
    : ''

  stateContentCacheByPath.set(statePath, persistedStateContent)
  return persistedStateContent
}

function flushPendingNoteStateWriteByPath(statePath: string): void {
  const pendingStateContent = pendingStateWriteByPath.get(statePath)
  if (pendingStateContent === undefined) {
    return
  }

  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
    stateFlushTimerByPath.delete(statePath)
  }

  const persistedStateContent = getPersistedStateContent(statePath)
  if (persistedStateContent !== pendingStateContent) {
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, pendingStateContent, 'utf8')
  }

  stateContentCacheByPath.set(statePath, pendingStateContent)
  pendingStateWriteByPath.delete(statePath)
}

function scheduleNoteStateFlush(statePath: string): void {
  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
  }

  const nextFlushTimer = setTimeout(
    () => flushPendingNoteStateWriteByPath(statePath),
    STATE_WRITE_DEBOUNCE_MS,
  )
  stateFlushTimerByPath.set(statePath, nextFlushTimer)
}

export function ensureNotesStateFile(paths: NotesPaths): void {
  fs.ensureDirSync(paths.notesRoot)
  fs.ensureDirSync(paths.metaDirPath)
  fs.ensureDirSync(paths.inboxDirPath)
  fs.ensureDirSync(paths.trashDirPath)

  if (!fs.pathExistsSync(paths.statePath)) {
    const defaultStateContent = `${JSON.stringify(createDefaultNotesState(), null, 2)}\n`
    fs.writeFileSync(paths.statePath, defaultStateContent, 'utf8')
    stateContentCacheByPath.set(paths.statePath, defaultStateContent)
  }
}

export function loadNotesState(paths: NotesPaths): NotesState {
  ensureNotesStateFile(paths)

  const defaultState = createDefaultNotesState()
  const rawState = fs.readJSONSync(paths.statePath) as NotesStateFile
  const legacyFolders = Array.isArray(rawState.folders) ? rawState.folders : []
  const folderUi = normalizeFolderUiState(rawState.folderUi)

  if (Object.keys(folderUi).length === 0 && legacyFolders.length) {
    legacyFolders.forEach((folder) => {
      folderUi[String(folder.id)] = {
        isOpen: normalizeFlag(folder.isOpen),
      }
    })
  }

  return {
    counters: {
      ...defaultState.counters,
      ...rawState.counters,
    },
    folderUi,
    folders: legacyFolders,
    notes: Array.isArray(rawState.notes) ? rawState.notes : [],
    tags: Array.isArray(rawState.tags) ? rawState.tags : [],
    version:
      typeof rawState.version === 'number'
        ? rawState.version
        : defaultState.version,
  }
}

export function saveNotesState(
  paths: NotesPaths,
  state: NotesState,
  options?: { immediate?: boolean },
): void {
  syncNotesFolderUiWithFolders(state)

  const nextVersion = Math.max(state.version, 1)
  state.version = nextVersion

  const persistedState: NotesStateFile = {
    counters: state.counters,
    folderUi: state.folderUi,
    notes: state.notes,
    tags: state.tags,
    version: nextVersion,
  }

  const nextContent = `${JSON.stringify(persistedState, null, 2)}\n`
  const statePath = paths.statePath
  const pendingContent = pendingStateWriteByPath.get(statePath)
  if (pendingContent === nextContent) {
    return
  }

  const persistedContent = getPersistedStateContent(statePath)
  if (persistedContent === nextContent && pendingContent === undefined) {
    return
  }

  pendingStateWriteByPath.set(statePath, nextContent)

  if (options?.immediate) {
    flushPendingNoteStateWriteByPath(statePath)
    return
  }

  scheduleNoteStateFlush(statePath)
}

export function flushPendingNotesStateWrite(paths: NotesPaths): void {
  flushPendingNoteStateWriteByPath(paths.statePath)
}
