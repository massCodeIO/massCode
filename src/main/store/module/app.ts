import type {
  AppStore,
  CodeState,
  NotesEditorMode,
  NotesState,
  SpaceLayoutMode,
} from '../types'
import Store from 'electron-store'
import { APP_DEFAULTS } from '../constants'
import {
  asRecord,
  isRecord,
  readEnum,
  readNumber,
  readOptionalNumber,
  readOptionalNumberArray,
  replaceStoreIfChanged,
} from '../sanitize'

const APP_STORE_DEFAULTS: AppStore = {
  window: {
    bounds: {},
  },
  ui: {
    compactListMode: false,
  },
  code: {
    selection: {},
    layout: {
      mode: 'all-panels',
      tagsListHeight: APP_DEFAULTS.sizes.tagsList,
    },
  },
  notes: {
    selection: {},
    editorMode: 'livePreview',
    layout: {
      mode: 'all-panels',
      tagsListHeight: APP_DEFAULTS.sizes.tagsList,
    },
  },
  notifications: {
    lastNotifiedUpdateVersion: '',
  },
}

function sanitizeCodeState(value: unknown): CodeState {
  const source = asRecord(value)
  const state: CodeState = {}

  if (typeof source.snippetId === 'number')
    state.snippetId = source.snippetId
  if (typeof source.snippetContentIndex === 'number')
    state.snippetContentIndex = source.snippetContentIndex
  if (typeof source.folderId === 'number')
    state.folderId = source.folderId
  if (typeof source.tagId === 'number')
    state.tagId = source.tagId
  if (typeof source.libraryFilter === 'string')
    state.libraryFilter = source.libraryFilter
  return state
}

function sanitizeNotesState(value: unknown): NotesState {
  const source = asRecord(value)
  const state: NotesState = {}

  if (typeof source.noteId === 'number')
    state.noteId = source.noteId
  if (typeof source.folderId === 'number')
    state.folderId = source.folderId
  if (typeof source.tagId === 'number')
    state.tagId = source.tagId
  if (typeof source.libraryFilter === 'string')
    state.libraryFilter = source.libraryFilter
  return state
}

function getLegacyCodeLayoutMode(
  source: Record<string, unknown>,
): SpaceLayoutMode {
  if (
    ['all-panels', 'list-editor', 'editor-only'].includes(
      String(source.codeLayoutMode),
    )
  ) {
    return source.codeLayoutMode as SpaceLayoutMode
  }

  return source.isSidebarHidden === true ? 'editor-only' : 'all-panels'
}

function getLegacyNotesLayoutMode(
  source: Record<string, unknown>,
): SpaceLayoutMode {
  if (source.isSidebarHidden !== true) {
    return 'all-panels'
  }

  return source.isListHidden === true ? 'editor-only' : 'list-editor'
}

function sanitizeAppStore(value: unknown): AppStore {
  const source = asRecord(value)
  const windowSource = asRecord(source.window)
  const codeSource = asRecord(source.code)
  const notesSource = asRecord(source.notes)
  const notificationsSource = asRecord(source.notifications)
  const legacySizes = asRecord(source.sizes)
  const codeLayoutSource = asRecord(codeSource.layout)
  const notesLayoutSource = asRecord(notesSource.layout)

  return {
    window: {
      bounds: isRecord(windowSource.bounds)
        ? windowSource.bounds
        : isRecord(source.bounds)
          ? source.bounds
          : APP_STORE_DEFAULTS.window.bounds,
    },
    ui: {
      compactListMode:
        typeof asRecord(source.ui).compactListMode === 'boolean'
          ? Boolean(asRecord(source.ui).compactListMode)
          : typeof source.compactListMode === 'boolean'
            ? source.compactListMode
            : APP_STORE_DEFAULTS.ui.compactListMode,
    },
    code: {
      selection: sanitizeCodeState(
        Object.keys(asRecord(codeSource.selection)).length > 0
          ? codeSource.selection
          : source.state,
      ),
      layout: {
        mode: readEnum(
          codeLayoutSource,
          'mode',
          ['all-panels', 'list-editor', 'editor-only'] as const,
          getLegacyCodeLayoutMode(asRecord(source.state)),
        ),
        tagsListHeight: readNumber(
          codeLayoutSource,
          'tagsListHeight',
          readNumber(
            legacySizes,
            'tagsListHeight',
            APP_STORE_DEFAULTS.code.layout.tagsListHeight,
          ),
        ),
        threePanel:
          readOptionalNumberArray(codeLayoutSource, 'threePanel')
          || readOptionalNumberArray(legacySizes, 'layout'),
        twoPanel:
          readOptionalNumberArray(codeLayoutSource, 'twoPanel')
          || readOptionalNumberArray(legacySizes, 'codeListLayout'),
      },
    },
    notes: {
      selection: sanitizeNotesState(
        Object.keys(asRecord(notesSource.selection)).length > 0
          ? notesSource.selection
          : source.notesState,
      ),
      editorMode: readEnum(
        notesSource,
        'editorMode',
        ['raw', 'livePreview', 'preview'] as const,
        readEnum(
          source,
          'notesEditorMode',
          ['raw', 'livePreview', 'preview'] as const,
          APP_STORE_DEFAULTS.notes.editorMode,
        ) as NotesEditorMode,
      ),
      layout: {
        mode: readEnum(
          notesLayoutSource,
          'mode',
          ['all-panels', 'list-editor', 'editor-only'] as const,
          getLegacyNotesLayoutMode(asRecord(source.notesState)),
        ),
        tagsListHeight: readNumber(
          notesLayoutSource,
          'tagsListHeight',
          readNumber(
            legacySizes,
            'notesTagsListHeight',
            APP_STORE_DEFAULTS.notes.layout.tagsListHeight,
          ),
        ),
        threePanel:
          readOptionalNumberArray(notesLayoutSource, 'threePanel')
          || readOptionalNumberArray(legacySizes, 'notesLayout'),
        twoPanel:
          readOptionalNumberArray(notesLayoutSource, 'twoPanel')
          || readOptionalNumberArray(legacySizes, 'notesLayoutWithoutSidebar'),
      },
    },
    notifications: {
      lastNotifiedUpdateVersion:
        typeof notificationsSource.lastNotifiedUpdateVersion === 'string'
          ? notificationsSource.lastNotifiedUpdateVersion
          : typeof source.lastNotifiedUpdateVersion === 'string'
            ? source.lastNotifiedUpdateVersion
            : APP_STORE_DEFAULTS.notifications.lastNotifiedUpdateVersion,
      nextDonateAt:
        readOptionalNumber(notificationsSource, 'nextDonateAt')
        ?? readOptionalNumber(source, 'nextDonateNotification'),
    },
  }
}

const appStore = new Store<AppStore>({
  name: 'app',
  cwd: 'v2',
})

replaceStoreIfChanged(appStore, sanitizeAppStore(appStore.store))

export default appStore
