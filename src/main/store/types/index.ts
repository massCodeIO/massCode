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
  isAutoMigratedFromJson: boolean
  nextDonateNotification?: number
  lastSeenReleaseNoticeVersion?: string
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
  engine: 'sqlite' | 'markdown'
  syncMode: 'manual' | 'realtime'
  vaultPath: string | null
}

export interface BackupSettings {
  path: string
  enabled: boolean
  interval: number
  maxBackups: number
  lastBackupTime?: number
}

export interface PreferencesStore {
  storagePath: string
  apiPort: number
  language: string
  theme: 'light' | 'dark' | 'auto'
  editor: EditorSettings
  storage: StorageSettings
  markdown: MarkdownSettings
  backup: BackupSettings
}

export interface Store {
  app: ElectronStore<AppStore>
  preferences: ElectronStore<PreferencesStore>
}
