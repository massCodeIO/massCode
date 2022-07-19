import type { EditorSettings, ScreenshotSettings } from '../renderer/store/app'
import type { SnippetsSort } from './db'

export interface AppStore {
  bounds: object
  dateInstallation?: number
  nextSupportNotice?: number
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
  screenshot: ScreenshotSettings
  theme: string
}
