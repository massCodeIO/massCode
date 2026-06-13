export type SpaceLayoutMode = 'all-panels' | 'list-editor' | 'editor-only'
export type NotesEditorMode = 'raw' | 'livePreview' | 'preview'

export interface CodeState {
  snippetId?: number
  snippetContentIndex?: number
  folderId?: number
  tagId?: number
  libraryFilter?: string
}

export interface NotesState {
  noteId?: number
  folderId?: number
  tagId?: number
  libraryFilter?: string
}

export interface HttpState {
  requestId?: number
  folderId?: number
  libraryFilter?: string
}

export type NotesRouteName =
  | 'notes-space'
  | 'notes-space/dashboard'
  | 'notes-space/graph'

export interface NotesDashboardWidgets {
  stats: boolean
  activityHeatmap: boolean
  recent: boolean
  graphPreview: boolean
  topLinked: boolean
}

export type SpaceId = 'code' | 'tools' | 'math' | 'notes' | 'http' | 'drawings'
export type CommandPaletteRecentTarget =
  | 'space'
  | 'snippet'
  | 'note'
  | 'http-request'
export type CommandPaletteUsageTarget = CommandPaletteRecentTarget | 'command'

export interface CommandPaletteRecentEntry {
  id: string
  target: CommandPaletteRecentTarget
  targetId: string
  title: string
  subtitle: string
  spaceId: SpaceId
  openedAt: number
}

export interface CommandPaletteUsageEntry {
  id: string
  target: CommandPaletteUsageTarget
  targetId: string
  openedAt: number
  openCount: number
  lastQuery?: string
}

export interface DonationsState {
  lastActiveDay: string
  currentStreak: number
  copies: {
    code: number
    http: number
    notes: number
    math: number
    tools: number
    drawings: number
  }
  created: {
    code: number
    http: number
    notes: number
    math: number
    drawings: number
  }
  sent: {
    http: number
  }
  lastShownCopyMilestones: {
    code: number
    http: number
    notes: number
    math: number
    tools: number
    drawings: number
  }
  lastShownCreatedMilestones: {
    code: number
    http: number
    notes: number
    math: number
    drawings: number
  }
  lastShownSentMilestones: {
    http: number
  }
  shownStreakMilestones: number[]
  lastGreetingDay: string
}

export interface AppStore {
  window: {
    bounds: object
  }
  ui: {
    compactListMode: boolean
  }
  code: {
    selection: CodeState
    layout: {
      mode: SpaceLayoutMode
      tagsListHeight: number
      threePanel?: number[]
      twoPanel?: number
    }
  }
  notes: {
    selection: NotesState
    route: NotesRouteName
    editorMode: NotesEditorMode
    dashboard: {
      widgets: NotesDashboardWidgets
    }
    layout: {
      mode: SpaceLayoutMode
      tagsListHeight: number
      threePanel?: number[]
      twoPanel?: number
    }
  }
  http: {
    selection: HttpState
    layout: {
      mode: SpaceLayoutMode
      environmentsListHeight: number
      threePanel?: number[]
      twoPanel?: number
      responsePanelHeight?: number
    }
  }
  notifications: {
    lastNotifiedUpdateVersion: string
    lastWhatsNewVersion: string
  }
  license: {
    key: string | null
    name: string | null
    email: string | null
  }
  commandPalette: {
    recent: CommandPaletteRecentEntry[]
    usage: CommandPaletteUsageEntry[]
  }
  donations: DonationsState
  drawings: {
    activeDrawingId: string | null
    viewport: Record<string, DrawingViewportState>
  }
  activeSpaceId: SpaceId
}

export interface DrawingViewportState {
  scrollX: number
  scrollY: number
  zoom: number
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
  sqliteMigrated: boolean
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

export interface MathSettings {
  locale: string
  decimalPlaces: number
  dateFormat: 'numeric' | 'short' | 'long'
}

export interface HttpSettings {
  wrapLines: boolean
  defaultPreviewFormat: 'http' | 'curl'
  autoSwitchToResponse: boolean
  skipCertificateVerification: boolean
}

export interface UpdatesSettings {
  autoUpdate: boolean
}

export interface PreferencesStore {
  appearance: {
    theme: string
  }
  updates: UpdatesSettings
  localization: {
    locale: string
  }
  api: {
    port: number
    integrations: {
      enabled: boolean
      tokenHash: string | null
      tokenPreview: string | null
    }
  }
  storage: StorageSettings & {
    rootPath: string
  }
  editor: {
    code: EditorSettings
    notes: NotesEditorSettings
    markdown: MarkdownSettings
  }
  math: MathSettings
  http: HttpSettings
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

export interface StoreBridge<_T extends Record<string, any>> {
  get: <V = unknown>(name: string) => V
  set: (name: string, value: unknown) => void
  delete: (name: string) => void
}

export interface Store {
  app: StoreBridge<AppStore>
  preferences: StoreBridge<PreferencesStore>
  mathNotebook: StoreBridge<MathNotebookStore>
}
