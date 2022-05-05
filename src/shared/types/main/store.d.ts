import type { EditorSettings } from '../renderer/store/app'
import type { SnippetsSort } from './db'

export interface AppStore {
  bounds: object
  dateInstallation?: number
  notifySupport: boolean
  selectedFolderAlias?: string
  selectedFolderId?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
  sidebarWidth: number
  snippetListWidth: number
  sort: SnippetsSort
  version?: string
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
  editor: EditorSettings
  theme: string
}
