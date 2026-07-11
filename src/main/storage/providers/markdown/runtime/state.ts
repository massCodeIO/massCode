import type { MarkdownState, MarkdownStateFile, Paths } from './types'
import { invalidateRuntimeSearchIndex } from './search'
import { createStateAdapter } from './shared/stateAdapter'
import {
  syncFolderIdByPathWithFolders,
  syncFolderUiWithFolders,
} from './shared/stateUtils'
import { flushPendingStateWrites } from './shared/stateWriter'

export { flushPendingStateWrites, syncFolderUiWithFolders }

// Версия 3: записи snippets несут денормализованные метаданные списка и
// stat-сигнатуру (`meta`). Записи без meta (v2) дозаполняются организно:
// файл читается один раз при первом скане и метаданные попадают в индекс.
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
    version: 3,
  }
}

const adapter = createStateAdapter<MarkdownState, MarkdownStateFile, Paths>({
  createDefaultState,
  minVersion: 3,
  getDirs: paths => [
    paths.vaultPath,
    paths.metaDirPath,
    paths.inboxDirPath,
    paths.trashDirPath,
  ],
  toPersistedState: state => ({
    counters: state.counters,
    // Fallback path → folder id для холодного старта с недокачанными
    // .meta.yaml (см. syncFolderIdByPathWithFolders).
    ...(state.folderIdByPath ? { folderIdByPath: state.folderIdByPath } : {}),
    folderUi: state.folderUi,
    // Записи индекса нормализуются до известной схемы: state.json
    // синхронизируется между устройствами и не должен накапливать
    // посторонние поля.
    snippets: state.snippets.map(({ filePath, id, meta }) => ({
      filePath,
      id,
      ...(meta ? { meta } : {}),
    })),
    tags: state.tags,
    version: state.version,
  }),
  parseRawState: (raw, defaults) => {
    const legacyFolders = Array.isArray(raw.folders) ? raw.folders : []

    return {
      counters: { ...defaults.counters, ...raw.counters },
      ...(raw.folderIdByPath && typeof raw.folderIdByPath === 'object'
        ? { folderIdByPath: raw.folderIdByPath }
        : {}),
      folderUi: (raw.folderUi ?? {}) as MarkdownState['folderUi'],
      folders: legacyFolders,
      snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      version: typeof raw.version === 'number' ? raw.version : defaults.version,
    }
  },
  onBeforeSave: (state) => {
    syncFolderUiWithFolders(state)
    syncFolderIdByPathWithFolders(state)
    invalidateRuntimeSearchIndex(state)
  },
})

export const { ensureStateFile, loadState, saveState } = adapter

export function flushPendingStateWrite(paths: Paths): void {
  adapter.flushPendingWrite(paths)
}
