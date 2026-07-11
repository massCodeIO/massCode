import type { NotesPaths, NotesState, NotesStateFile } from './types'
import { createStateAdapter } from '../../runtime/shared/stateAdapter'
import {
  syncFolderIdByPathWithFolders,
  syncFolderUiWithFolders,
} from '../../runtime/shared/stateUtils'
import { invalidateNotesSearchIndex } from './search'

// Версия 2: записи notes несут денормализованные метаданные списка и
// stat-сигнатуру (`meta`). Записи без meta (v1) дозаполняются организно:
// файл читается один раз при первом скане и метаданные попадают в индекс.
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
    version: 2,
  }
}

const adapter = createStateAdapter<NotesState, NotesStateFile, NotesPaths>({
  createDefaultState: createDefaultNotesState,
  minVersion: 2,
  getDirs: paths => [
    paths.notesRoot,
    paths.metaDirPath,
    paths.inboxDirPath,
    paths.trashDirPath,
  ],
  toPersistedState: state => ({
    counters: state.counters,
    // Очередь отложенных rewrite'ов [[ссылок]] переживает перезапуск:
    // без персиста переименование цели оставило бы в ещё не докачанных
    // линкерах старую ссылку навсегда.
    ...(state.deferredBacklinkRewrites?.length
      ? { deferredBacklinkRewrites: state.deferredBacklinkRewrites }
      : {}),
    // Fallback path → folder id для холодного старта с недокачанными
    // .meta.yaml (см. syncFolderIdByPathWithFolders).
    ...(state.folderIdByPath ? { folderIdByPath: state.folderIdByPath } : {}),
    folderUi: state.folderUi,
    // Записи индекса нормализуются до известной схемы: state.json
    // синхронизируется между устройствами и не должен накапливать
    // посторонние поля.
    notes: state.notes.map(({ filePath, id, meta }) => ({
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
      ...(Array.isArray(raw.deferredBacklinkRewrites)
        ? { deferredBacklinkRewrites: raw.deferredBacklinkRewrites }
        : {}),
      ...(raw.folderIdByPath && typeof raw.folderIdByPath === 'object'
        ? { folderIdByPath: raw.folderIdByPath }
        : {}),
      folderUi: (raw.folderUi ?? {}) as NotesState['folderUi'],
      folders: legacyFolders,
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      version: typeof raw.version === 'number' ? raw.version : defaults.version,
    }
  },
  onBeforeSave: (state) => {
    syncFolderUiWithFolders(state)
    syncFolderIdByPathWithFolders(state)
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
