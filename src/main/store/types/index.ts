import type ElectronStore from 'electron-store'
import type { Settings as EditorSettings } from '../../../renderer/composables/types/editor'

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
  editor: EditorSettings
}

export interface Store {
  app: ElectronStore<AppStore>
  preferences: ElectronStore<PreferencesStore>
}
