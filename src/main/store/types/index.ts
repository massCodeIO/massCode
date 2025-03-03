import type ElectronStore from 'electron-store'

export interface AppStore {
  bounds: object
  isAutoMigratedFromJson: boolean
  sidebarWidth: number
  snippetListWidth: number
  selectedFolderId?: number
  selectedSnippetId?: number
  selectedLibrary?: string
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
  apiPort: number
}

export interface Store {
  app: ElectronStore<AppStore>
  preferences: ElectronStore<PreferencesStore>
}
