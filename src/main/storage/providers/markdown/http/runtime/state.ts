import type {
  HttpCounters,
  HttpFolderRecord,
  HttpPaths,
  HttpState,
  HttpStateFile,
} from './types'
import fs from 'fs-extra'
import { pendingStateWriteByPath } from '../../runtime/cache'
import { readSpaceState, writeSpaceState } from '../../runtime/spaceState'
import { HTTP_HISTORY_CAP } from './constants'

// Версия 2: записи requests несут денормализованные метаданные списка и
// stat-сигнатуру (`meta`). Записи без meta (v1) дозаполняются организно:
// файл читается один раз при первом скане и метаданные попадают в индекс.
const STATE_VERSION = 2

export function createDefaultHttpState(): HttpState {
  return {
    version: STATE_VERSION,
    counters: {
      folderId: 0,
      requestId: 0,
      environmentId: 0,
      historyId: 0,
    },
    folders: [],
    requests: [],
    environments: [],
    activeEnvironmentId: null,
    history: [],
  }
}

function normalizeCounters(
  raw: Partial<HttpCounters> | undefined,
): HttpCounters {
  const defaults = createDefaultHttpState().counters
  return {
    folderId:
      typeof raw?.folderId === 'number' ? raw.folderId : defaults.folderId,
    requestId:
      typeof raw?.requestId === 'number' ? raw.requestId : defaults.requestId,
    environmentId:
      typeof raw?.environmentId === 'number'
        ? raw.environmentId
        : defaults.environmentId,
    historyId:
      typeof raw?.historyId === 'number' ? raw.historyId : defaults.historyId,
  }
}

function normalizeFolders(raw: HttpStateFile['folders']): HttpFolderRecord[] {
  if (!Array.isArray(raw))
    return []

  return raw.map(folder => ({
    ...folder,
    icon:
      folder.icon === null
        ? null
        : typeof folder.icon === 'string'
          ? folder.icon
          : null,
  }))
}

export function ensureHttpStateFile(paths: HttpPaths): void {
  fs.ensureDirSync(paths.httpRoot)

  // Ожидающая debounce-запись уже содержит актуальный state: перезапись
  // дефолтом потеряла бы индекс и environments, записанные за последние
  // мгновения до того, как файл впервые доехал до диска.
  if (pendingStateWriteByPath.has(paths.statePath)) {
    return
  }

  if (!fs.pathExistsSync(paths.statePath)) {
    writeSpaceState(paths.statePath, createDefaultHttpState())
  }
}

export function loadHttpState(paths: HttpPaths): HttpState {
  ensureHttpStateFile(paths)

  const raw = readSpaceState<HttpStateFile>(paths.statePath)
  const defaults = createDefaultHttpState()

  if (!raw) {
    return defaults
  }

  return {
    version: typeof raw.version === 'number' ? raw.version : defaults.version,
    counters: normalizeCounters(raw.counters),
    folders: normalizeFolders(raw.folders),
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    environments: Array.isArray(raw.environments) ? raw.environments : [],
    activeEnvironmentId:
      typeof raw.activeEnvironmentId === 'number'
        ? raw.activeEnvironmentId
        : null,
    history: Array.isArray(raw.history)
      ? raw.history.slice(-HTTP_HISTORY_CAP)
      : [],
  }
}

export function saveHttpState(paths: HttpPaths, state: HttpState): void {
  // Provisional state существует только пока .state.yaml не докачан из
  // облака: записать его — значит затереть настоящий индекс и environments
  // почти пустым состоянием.
  if (state.provisional) {
    return
  }

  state.version = Math.max(state.version, STATE_VERSION)

  if (state.history.length > HTTP_HISTORY_CAP) {
    state.history = state.history.slice(-HTTP_HISTORY_CAP)
  }

  // Персистится явная схема: .state.yaml синхронизируется между
  // устройствами и не должен накапливать посторонние и runtime-поля.
  writeSpaceState(paths.statePath, {
    version: state.version,
    counters: state.counters,
    folders: state.folders,
    requests: state.requests.map(({ filePath, id, meta }) => ({
      filePath,
      id,
      ...(meta ? { meta } : {}),
    })),
    environments: state.environments,
    activeEnvironmentId: state.activeEnvironmentId,
    history: state.history,
  })
}
