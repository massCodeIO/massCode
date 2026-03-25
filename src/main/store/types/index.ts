import type ElectronStore from 'electron-store'

export interface AppStore {
  bounds: object
  sizes: {
    sidebarWidth: number
    snippetListWidth: number
    tagsListHeight: number
  }
  state: {
    snippetId?: number
    snippetContentIndex?: number
    folderId?: number
    tagId?: number
    libraryFilter?: string
    isSidebarHidden?: boolean
  }
  nextDonateNotification?: number
  lastNotifiedUpdateVersion?: string
}

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  wrap: boolean
  tabSize: number
  trailingComma: 'all' | 'none' | 'es5'
  semi: boolean
  singleQuote: boolean
  highlightLine: boolean
  matchBrackets: boolean
}

export interface MarkdownSettings {
  scale: number
}

export interface StorageSettings {
  vaultPath: string | null
}

export interface NotesEditorSettings {
  fontSize: number
  fontFamily: string
  codeFontFamily: string
  lineHeight: number
  limitWidth: boolean
  lineNumbers: boolean
  indentSize: number
}

export interface PreferencesStore {
  storagePath: string
  apiPort: number
  language: string
  theme: string
  editor: EditorSettings
  notesEditor: NotesEditorSettings
  storage: StorageSettings
  markdown: MarkdownSettings
}

export interface MathSheet {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface MathNotebookStore {
  sheets: MathSheet[]
  activeSheetId: string | null
}

export interface CurrencyRatesCache {
  rates: Record<string, number>
  fetchedAt: number
}

export interface CurrencyRatesStore {
  cache: CurrencyRatesCache | null
}

export interface Store {
  app: ElectronStore<AppStore>
  preferences: ElectronStore<PreferencesStore>
  mathNotebook: ElectronStore<MathNotebookStore>
  currencyRates: ElectronStore<CurrencyRatesStore>
}
