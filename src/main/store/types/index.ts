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
  }
  isAutoMigratedFromJson: boolean
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
  apiPort: number
  language: string
  theme: 'light' | 'dark' | 'auto'
}

export interface Store {
  app: ElectronStore<AppStore>
  preferences: ElectronStore<PreferencesStore>
}
