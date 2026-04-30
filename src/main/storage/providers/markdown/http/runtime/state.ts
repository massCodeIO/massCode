import type {
  HttpCounters,
  HttpPaths,
  HttpState,
  HttpStateFile,
} from './types'
import fs from 'fs-extra'
import { readSpaceState, writeSpaceState } from '../../runtime/spaceState'
import { HTTP_HISTORY_CAP } from './constants'

const STATE_VERSION = 1

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

export function ensureHttpStateFile(paths: HttpPaths): void {
  fs.ensureDirSync(paths.httpRoot)

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
    folders: Array.isArray(raw.folders) ? raw.folders : [],
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
  state.version = Math.max(state.version, STATE_VERSION)

  if (state.history.length > HTTP_HISTORY_CAP) {
    state.history = state.history.slice(-HTTP_HISTORY_CAP)
  }

  writeSpaceState(paths.statePath, state)
}
