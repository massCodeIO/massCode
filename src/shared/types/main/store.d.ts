import type { EditorSettings } from '../renderer/store/app'

export interface AppStore {
  bounds: object
  selectedFolderId?: string
  selectedFolderAlias?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
  sidebarWidth: number
  snippetListWidth: number
  version?: string
  notifySupport: boolean
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
  editor: EditorSettings
  theme: string
}
