import type { MarkdownState, MarkdownStateFile, Paths } from './types'
import { invalidateRuntimeSearchIndex } from './search'
import { createStateAdapter } from './shared/stateAdapter'
import { syncFolderUiWithFolders } from './shared/stateUtils'
import { flushPendingStateWrites } from './shared/stateWriter'

export { flushPendingStateWrites, syncFolderUiWithFolders }

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

const adapter = createStateAdapter<MarkdownState, MarkdownStateFile, Paths>({
  createDefaultState,
  minVersion: 2,
  getDirs: paths => [
    paths.vaultPath,
    paths.metaDirPath,
    paths.inboxDirPath,
    paths.trashDirPath,
  ],
  toPersistedState: state => ({
    counters: state.counters,
    folderUi: state.folderUi,
    snippets: state.snippets,
    tags: state.tags,
    version: state.version,
  }),
  parseRawState: (raw, defaults) => {
    const legacyFolders = Array.isArray(raw.folders) ? raw.folders : []

    return {
      counters: { ...defaults.counters, ...raw.counters },
      folderUi: raw.folderUi ?? {},
      folders: legacyFolders,
      snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      version: typeof raw.version === 'number' ? raw.version : defaults.version,
    }
  },
  onBeforeSave: (state) => {
    syncFolderUiWithFolders(state)
    invalidateRuntimeSearchIndex(state)
  },
})

export const { ensureStateFile, loadState, saveState } = adapter

export function flushPendingStateWrite(paths: Paths): void {
  adapter.flushPendingWrite(paths)
}
