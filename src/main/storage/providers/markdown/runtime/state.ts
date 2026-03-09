import type {
  MarkdownFolderUIState,
  MarkdownState,
  MarkdownStateFile,
  Paths,
  SaveStateOptions,
} from './types'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'
import {
  pendingStateWriteByPath,
  STATE_WRITE_DEBOUNCE_MS,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from './constants'
import { normalizeFlag, normalizeFolderUiState } from './normalizers'
import { invalidateRuntimeSearchIndex } from './search'

let stateWriteHooksRegistered = false

export function createDefaultState(): MarkdownState {
  return {
    counters: {
      contentId: 0,
      folderId: 0,
      snippetId: 0,
      tagId: 0,
    },
    folderUi: {},
    folders: [],
    snippets: [],
    tags: [],
    version: 2,
  }
}

export function syncFolderUiWithFolders(state: MarkdownState): void {
  const nextFolderUi: Record<string, MarkdownFolderUIState> = {}

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

function flushPendingStateWriteByPath(statePath: string): void {
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

function scheduleStateFlush(statePath: string): void {
  const flushTimer = stateFlushTimerByPath.get(statePath)
  if (flushTimer) {
    clearTimeout(flushTimer)
  }

  const nextFlushTimer = setTimeout(
    () => flushPendingStateWriteByPath(statePath),
    STATE_WRITE_DEBOUNCE_MS,
  )
  stateFlushTimerByPath.set(statePath, nextFlushTimer)
}

export function flushPendingStateWrite(paths: Paths): void {
  flushPendingStateWriteByPath(paths.statePath)
}

export function flushPendingStateWrites(): void {
  const pathsWithPendingWrites = [...pendingStateWriteByPath.keys()]
  pathsWithPendingWrites.forEach(statePath =>
    flushPendingStateWriteByPath(statePath),
  )
}

function registerStateWriteHooks(): void {
  if (stateWriteHooksRegistered) {
    return
  }

  stateWriteHooksRegistered = true
  process.once('beforeExit', flushPendingStateWrites)
  process.once('exit', flushPendingStateWrites)
}

export function ensureStateFile(paths: Paths): void {
  registerStateWriteHooks()

  fs.ensureDirSync(paths.vaultPath)
  fs.ensureDirSync(paths.metaDirPath)
  fs.ensureDirSync(paths.inboxDirPath)
  fs.ensureDirSync(paths.trashDirPath)

  if (!fs.pathExistsSync(paths.statePath)) {
    const defaultStateContent = `${JSON.stringify(createDefaultState(), null, 2)}\n`
    fs.writeFileSync(paths.statePath, defaultStateContent, 'utf8')
    stateContentCacheByPath.set(paths.statePath, defaultStateContent)
  }
}

export function loadState(paths: Paths): MarkdownState {
  ensureStateFile(paths)

  const defaultState = createDefaultState()
  const rawState = fs.readJSONSync(paths.statePath) as MarkdownStateFile
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
    snippets: Array.isArray(rawState.snippets) ? rawState.snippets : [],
    tags: Array.isArray(rawState.tags) ? rawState.tags : [],
    version:
      typeof rawState.version === 'number'
        ? rawState.version
        : defaultState.version,
  }
}

export function saveState(
  paths: Paths,
  state: MarkdownState,
  options?: SaveStateOptions,
): void {
  syncFolderUiWithFolders(state)
  invalidateRuntimeSearchIndex(state)

  const nextVersion = Math.max(state.version, 2)
  state.version = nextVersion

  const persistedState: MarkdownStateFile = {
    counters: state.counters,
    folderUi: state.folderUi,
    snippets: state.snippets,
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
    flushPendingStateWrite(paths)
    return
  }

  scheduleStateFlush(statePath)
}
