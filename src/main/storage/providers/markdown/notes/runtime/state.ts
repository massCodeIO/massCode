import type { NotesPaths, NotesState, NotesStateFile } from './types'
import { createStateAdapter } from '../../runtime/shared/stateAdapter'
import { syncFolderUiWithFolders } from '../../runtime/shared/stateUtils'
import { invalidateNotesSearchIndex } from './search'

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

const adapter = createStateAdapter<NotesState, NotesStateFile, NotesPaths>({
  createDefaultState: createDefaultNotesState,
  minVersion: 1,
  getDirs: paths => [
    paths.notesRoot,
    paths.metaDirPath,
    paths.inboxDirPath,
    paths.trashDirPath,
  ],
  toPersistedState: state => ({
    counters: state.counters,
    folderUi: state.folderUi,
    notes: state.notes,
    tags: state.tags,
    version: state.version,
  }),
  parseRawState: (raw, defaults) => {
    const legacyFolders = Array.isArray(raw.folders) ? raw.folders : []

    return {
      counters: { ...defaults.counters, ...raw.counters },
      folderUi: raw.folderUi ?? {},
      folders: legacyFolders,
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      version: typeof raw.version === 'number' ? raw.version : defaults.version,
    }
  },
  onBeforeSave: (state) => {
    syncFolderUiWithFolders(state)
    invalidateNotesSearchIndex(state)
  },
})

export const {
  ensureStateFile: ensureNotesStateFile,
  loadState: loadNotesState,
  saveState: saveNotesState,
} = adapter

export function flushPendingNotesStateWrite(paths: NotesPaths): void {
  adapter.flushPendingWrite(paths)
}
