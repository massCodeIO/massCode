import type {
  AppStore,
  CodeState,
  NotesEditorMode,
  NotesRouteName,
  NotesState,
  SpaceId,
  SpaceLayoutMode,
} from '../types'
import Store from 'electron-store'
import { LAYOUT_DEFAULTS } from '../constants'
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
      tagsListHeight: LAYOUT_DEFAULTS.tags.height,
    },
  },
  notes: {
    selection: {},
    route: 'notes-space',
    editorMode: 'livePreview',
    dashboard: {
      widgets: {
        stats: true,
        activityHeatmap: true,
        recent: true,
        graphPreview: true,
        topLinked: true,
      },
    },
    layout: {
      mode: 'all-panels',
      tagsListHeight: LAYOUT_DEFAULTS.tags.height,
    },
  },
  notifications: {
    lastNotifiedUpdateVersion: '',
  },
  activeSpaceId: 'code',
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
        tagsListHeight: (() => {
          const raw = readNumber(
            codeLayoutSource,
            'tagsListHeight',
            readNumber(
              legacySizes,
              'tagsListHeight',
              LAYOUT_DEFAULTS.tags.height,
            ),
          )
          return raw < 100 ? LAYOUT_DEFAULTS.tags.height : raw
        })(),
        threePanel:
          readOptionalNumberArray(codeLayoutSource, 'threePanel')
          || readOptionalNumberArray(legacySizes, 'layout'),
        twoPanel:
          readOptionalNumber(codeLayoutSource, 'twoPanel')
          ?? readOptionalNumber(legacySizes, 'codeListLayout')
          ?? undefined,
      },
    },
    notes: {
      selection: sanitizeNotesState(
        Object.keys(asRecord(notesSource.selection)).length > 0
          ? notesSource.selection
          : source.notesState,
      ),
      route: readEnum(
        notesSource,
        'route',
        ['notes-space', 'notes-space/dashboard', 'notes-space/graph'] as const,
        readEnum(
          source,
          'notesRoute',
          [
            'notes-space',
            'notes-space/dashboard',
            'notes-space/graph',
          ] as const,
          APP_STORE_DEFAULTS.notes.route,
        ) as NotesRouteName,
      ) as NotesRouteName,
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
      dashboard: {
        widgets: (() => {
          const dashSource = asRecord(asRecord(notesSource.dashboard).widgets)
          const defaults = APP_STORE_DEFAULTS.notes.dashboard.widgets

          return {
            stats:
              typeof dashSource.stats === 'boolean'
                ? dashSource.stats
                : defaults.stats,
            activityHeatmap:
              typeof dashSource.activityHeatmap === 'boolean'
                ? dashSource.activityHeatmap
                : defaults.activityHeatmap,
            recent:
              typeof dashSource.recent === 'boolean'
                ? dashSource.recent
                : defaults.recent,
            graphPreview:
              typeof dashSource.graphPreview === 'boolean'
                ? dashSource.graphPreview
                : defaults.graphPreview,
            topLinked:
              typeof dashSource.topLinked === 'boolean'
                ? dashSource.topLinked
                : defaults.topLinked,
          }
        })(),
      },
      layout: {
        mode: readEnum(
          notesLayoutSource,
          'mode',
          ['all-panels', 'list-editor', 'editor-only'] as const,
          getLegacyNotesLayoutMode(asRecord(source.notesState)),
        ),
        tagsListHeight: (() => {
          const raw = readNumber(
            notesLayoutSource,
            'tagsListHeight',
            readNumber(
              legacySizes,
              'notesTagsListHeight',
              LAYOUT_DEFAULTS.tags.height,
            ),
          )
          return raw < 100 ? LAYOUT_DEFAULTS.tags.height : raw
        })(),
        threePanel:
          readOptionalNumberArray(notesLayoutSource, 'threePanel')
          || readOptionalNumberArray(legacySizes, 'notesLayout'),
        twoPanel:
          readOptionalNumber(notesLayoutSource, 'twoPanel')
          ?? readOptionalNumber(legacySizes, 'notesLayoutWithoutSidebar')
          ?? undefined,
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
    activeSpaceId: readEnum(
      source,
      'activeSpaceId',
      ['code', 'tools', 'math', 'notes'] as const,
      APP_STORE_DEFAULTS.activeSpaceId,
    ) as SpaceId,
  }
}

const appStore = new Store<AppStore>({
  name: 'app',
  cwd: 'v2',
})

replaceStoreIfChanged(appStore, sanitizeAppStore(appStore.store))

export default appStore
