export interface AppStore {
  bounds: object
  selectedFolderId?: string
  selectedFolderAlias?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
  sidebarWidth: number
  snippetListWidth: number
}

interface Editor {
  fontFamily: string
  fontSize: number
  showInvisibles: boolean
  tabSize: number
  wrap: string
}
export interface PreferencesStore {
  storagePath: string
  backupPath: string
  editor: Editor
}
