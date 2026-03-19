import fs from 'fs-extra'
import { stateContentCacheByPath } from '../cache'
import { normalizeFlag, normalizeFolderUiState } from '../normalizers'
import {
  flushPendingStateWriteByPath,
  registerStateWriteHooks,
  scheduleStateFlush,
} from './stateWriter'

interface StateWithFolderUi {
  folders: { id: number, isOpen: number }[]
  folderUi: Record<string, { isOpen: number }>
  version: number
}

export interface StateAdapterConfig<
  TState extends StateWithFolderUi,
  TStateFile,
  TPaths extends { statePath: string },
> {
  createDefaultState: () => TState
  minVersion: number
  getDirs: (paths: TPaths) => string[]
  toPersistedState: (state: TState) => TStateFile
  parseRawState: (raw: TStateFile, defaults: TState) => TState
  onBeforeSave?: (state: TState) => void
}

export interface StateAdapter<TState, TPaths> {
  ensureStateFile: (paths: TPaths) => void
  loadState: (paths: TPaths) => TState
  saveState: (
    paths: TPaths,
    state: TState,
    options?: { immediate?: boolean },
  ) => void
  flushPendingWrite: (paths: TPaths) => void
}

export function createStateAdapter<
  TState extends StateWithFolderUi,
  TStateFile,
  TPaths extends { statePath: string },
>(
  config: StateAdapterConfig<TState, TStateFile, TPaths>,
): StateAdapter<TState, TPaths> {
  function ensureStateFile(paths: TPaths): void {
    registerStateWriteHooks()

    for (const dir of config.getDirs(paths)) {
      fs.ensureDirSync(dir)
    }

    if (!fs.pathExistsSync(paths.statePath)) {
      const defaultStateContent = `${JSON.stringify(config.createDefaultState(), null, 2)}\n`
      fs.writeFileSync(paths.statePath, defaultStateContent, 'utf8')
      stateContentCacheByPath.set(paths.statePath, defaultStateContent)
    }
  }

  function loadState(paths: TPaths): TState {
    ensureStateFile(paths)

    const defaults = config.createDefaultState()
    const raw = fs.readJSONSync(paths.statePath) as TStateFile
    const state = config.parseRawState(raw, defaults)

    // Legacy folderUi migration
    const folderUi = normalizeFolderUiState(state.folderUi)

    if (Object.keys(folderUi).length === 0 && state.folders.length) {
      state.folders.forEach((folder) => {
        folderUi[String(folder.id)] = {
          isOpen: normalizeFlag(folder.isOpen),
        }
      })
    }

    state.folderUi = folderUi

    return state
  }

  function saveState(
    paths: TPaths,
    state: TState,
    options?: { immediate?: boolean },
  ): void {
    config.onBeforeSave?.(state)

    const nextVersion = Math.max(state.version, config.minVersion)
    state.version = nextVersion

    const persistedState = config.toPersistedState(state)
    const nextContent = `${JSON.stringify(persistedState, null, 2)}\n`

    scheduleStateFlush(
      paths.statePath,
      nextContent,
      options?.immediate ? { immediate: true } : undefined,
    )
  }

  function flushPendingWrite(paths: TPaths): void {
    flushPendingStateWriteByPath(paths.statePath)
  }

  return { ensureStateFile, loadState, saveState, flushPendingWrite }
}
