import type { EditorSettings, ScreenshotSettings } from '../renderer/store/app'
import type { SnippetsSort } from './db'

export interface AppStore {
  bounds: object
  dateInstallation?: number
  nextSupportNotice?: number
  prevRemoteNotice?: number
  selectedFolderAlias?: string
  selectedFolderId?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
  sidebarWidth: number
  snippetListWidth: number
  sort: SnippetsSort
  hideSubfolderSnippets?: boolean
  version?: string
}

export interface MarkdownSettings {
  codeRenderer: 'codemirror' | 'highlight.js'
  presentationScale: number
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
  editor: EditorSettings
  screenshot: ScreenshotSettings
  markdown: MarkdownSettings
  theme: string
  language: string
}
