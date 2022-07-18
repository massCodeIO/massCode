import type { EditorSettings, ScreenshotSettings } from '../renderer/store/app'
import type { SnippetsSort } from './db'
import type { LanguageOption } from '../renderer/editor'

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
  customLanguages: LanguageOption[]
  storagePath: string
  backupPath: string
  editor: EditorSettings
  screenshot: ScreenshotSettings
  theme: string
}
