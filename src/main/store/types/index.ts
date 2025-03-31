import type ElectronStore from 'electron-store'

export interface AppStore {
  bounds: object
  isAutoMigratedFromJson: boolean
  selectedFolderId?: number
  selectedSnippetId?: number
  selectedLibrary?: string
  sizes: {
    sidebarWidth: number
    snippetListWidth: number
    tagsListHeight: number
  }
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
  apiPort: number
  language: string
}

export interface Store {
  app: ElectronStore<AppStore>
  preferences: ElectronStore<PreferencesStore>
}
