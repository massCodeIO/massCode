import fs from 'fs-extra'
import { stateContentCacheByPath } from '../cache'
import { normalizeFlag, normalizeFolderUiState } from '../normalizers'
import { markAppWrittenFileAsLocal } from './cloudFiles'
import { readVaultTextFileSync } from './guardedRead'
import {
  flushPendingStateWriteByPath,
  scheduleStateFlush,
} from './stateWriter'

interface StateWithFolderUi {
  folders: { id: number, isOpen: number }[]
  folderUi: Record<string, { isOpen: number }>
  provisional?: boolean
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
    for (const dir of config.getDirs(paths)) {
      fs.ensureDirSync(dir)
    }

    if (!fs.pathExistsSync(paths.statePath)) {
      const defaultStateContent = `${JSON.stringify(config.createDefaultState(), null, 2)}\n`
      fs.writeFileSync(paths.statePath, defaultStateContent, 'utf8')
      markAppWrittenFileAsLocal(paths.statePath)
      stateContentCacheByPath.set(paths.statePath, defaultStateContent)
    }
  }

  function loadState(paths: TPaths): TState {
    ensureStateFile(paths)

    const defaults = config.createDefaultState()
    // Guarded-чтение: недокачанный state.json прерывает скан ошибкой вместо
    // блокировки main process (и вместо чеканки дефолтного state, которая
    // раздала бы всем записям новые id).
    const raw = JSON.parse(
      readVaultTextFileSync(paths.statePath),
    ) as TStateFile
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
    // Provisional state существует только пока state-файл не докачан из
    // облака: записать его — значит затереть настоящий индекс и счётчики
    // почти пустым состоянием.
    if (state.provisional) {
      return
    }

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
