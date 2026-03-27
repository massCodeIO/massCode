import type {
  EditorSettings,
  MarkdownSettings,
  NotesEditorSettings,
  PreferencesStore,
} from '../types'
import { homedir, platform } from 'node:os'
import Store from 'electron-store'
import { EDITOR_DEFAULTS, NOTES_EDITOR_DEFAULTS } from '../constants'
import {
  asRecord,
  readEnum,
  readNullableString,
  readNumber,
  readString,
  replaceStoreIfChanged,
} from '../sanitize'

const isWin = platform() === 'win32'

const storagePath = isWin ? `${homedir()}\\massCode` : `${homedir()}/massCode`

const PREFERENCES_DEFAULTS: PreferencesStore = {
  appearance: {
    theme: 'auto',
  },
  localization: {
    locale: 'en_US',
  },
  api: {
    port: 4321,
  },
  storage: {
    rootPath: storagePath,
    vaultPath: null,
  },
  editor: {
    code: EDITOR_DEFAULTS,
    notes: NOTES_EDITOR_DEFAULTS,
    markdown: {
      scale: 1,
    },
  },
}

function sanitizeCodeEditorSettings(value: unknown): EditorSettings {
  const source = asRecord(value)

  return {
    fontSize: readNumber(
      source,
      'fontSize',
      PREFERENCES_DEFAULTS.editor.code.fontSize,
    ),
    fontFamily: readString(
      source,
      'fontFamily',
      PREFERENCES_DEFAULTS.editor.code.fontFamily,
    ),
    wrap:
      typeof source.wrap === 'boolean'
        ? source.wrap
        : PREFERENCES_DEFAULTS.editor.code.wrap,
    tabSize: readNumber(
      source,
      'tabSize',
      PREFERENCES_DEFAULTS.editor.code.tabSize,
    ),
    trailingComma: readEnum(
      source,
      'trailingComma',
      ['all', 'none', 'es5'] as const,
      PREFERENCES_DEFAULTS.editor.code.trailingComma,
    ),
    semi:
      typeof source.semi === 'boolean'
        ? source.semi
        : PREFERENCES_DEFAULTS.editor.code.semi,
    singleQuote:
      typeof source.singleQuote === 'boolean'
        ? source.singleQuote
        : PREFERENCES_DEFAULTS.editor.code.singleQuote,
    highlightLine:
      typeof source.highlightLine === 'boolean'
        ? source.highlightLine
        : PREFERENCES_DEFAULTS.editor.code.highlightLine,
    matchBrackets:
      typeof source.matchBrackets === 'boolean'
        ? source.matchBrackets
        : PREFERENCES_DEFAULTS.editor.code.matchBrackets,
  }
}

function sanitizeNotesEditorSettings(value: unknown): NotesEditorSettings {
  const source = asRecord(value)

  return {
    fontSize: readNumber(
      source,
      'fontSize',
      PREFERENCES_DEFAULTS.editor.notes.fontSize,
    ),
    fontFamily: readString(
      source,
      'fontFamily',
      PREFERENCES_DEFAULTS.editor.notes.fontFamily,
    ),
    codeFontFamily: readString(
      source,
      'codeFontFamily',
      PREFERENCES_DEFAULTS.editor.notes.codeFontFamily,
    ),
    lineHeight: readNumber(
      source,
      'lineHeight',
      PREFERENCES_DEFAULTS.editor.notes.lineHeight,
    ),
    limitWidth:
      typeof source.limitWidth === 'boolean'
        ? source.limitWidth
        : PREFERENCES_DEFAULTS.editor.notes.limitWidth,
    lineNumbers:
      typeof source.lineNumbers === 'boolean'
        ? source.lineNumbers
        : PREFERENCES_DEFAULTS.editor.notes.lineNumbers,
    indentSize: readNumber(
      source,
      'indentSize',
      PREFERENCES_DEFAULTS.editor.notes.indentSize,
    ),
  }
}

function sanitizeMarkdownSettings(value: unknown): MarkdownSettings {
  const source = asRecord(value)

  return {
    scale: readNumber(
      source,
      'scale',
      PREFERENCES_DEFAULTS.editor.markdown.scale,
    ),
  }
}

function sanitizePreferences(value: unknown): PreferencesStore {
  const source = asRecord(value)
  const appearanceSource = asRecord(source.appearance)
  const localizationSource = asRecord(source.localization)
  const apiSource = asRecord(source.api)
  const storageSource = asRecord(source.storage)
  const editorSource = asRecord(source.editor)
  const codeEditorSource
    = Object.keys(asRecord(editorSource.code)).length > 0
      ? asRecord(editorSource.code)
      : editorSource
  const notesEditorSource
    = Object.keys(asRecord(editorSource.notes)).length > 0
      ? asRecord(editorSource.notes)
      : asRecord(source.notesEditor)
  const markdownSource
    = Object.keys(asRecord(editorSource.markdown)).length > 0
      ? asRecord(editorSource.markdown)
      : asRecord(source.markdown)

  return {
    appearance: {
      theme: readString(
        appearanceSource,
        'theme',
        readString(source, 'theme', PREFERENCES_DEFAULTS.appearance.theme),
      ),
    },
    localization: {
      locale: readString(
        localizationSource,
        'locale',
        readString(
          source,
          'language',
          PREFERENCES_DEFAULTS.localization.locale,
        ),
      ),
    },
    api: {
      port: readNumber(
        apiSource,
        'port',
        readNumber(source, 'apiPort', PREFERENCES_DEFAULTS.api.port),
      ),
    },
    storage: {
      rootPath: readString(
        storageSource,
        'rootPath',
        readString(
          source,
          'storagePath',
          PREFERENCES_DEFAULTS.storage.rootPath,
        ),
      ),
      vaultPath: readNullableString(
        storageSource,
        'vaultPath',
        PREFERENCES_DEFAULTS.storage.vaultPath,
      ),
    },
    editor: {
      code: sanitizeCodeEditorSettings(codeEditorSource),
      notes: sanitizeNotesEditorSettings(notesEditorSource),
      markdown: sanitizeMarkdownSettings(markdownSource),
    },
  }
}

const preferencesStore = new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',
})

replaceStoreIfChanged(
  preferencesStore,
  sanitizePreferences(preferencesStore.store),
)

export default preferencesStore
