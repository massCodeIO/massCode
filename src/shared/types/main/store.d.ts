export interface AppStore {
  bounds: object
  selectedFolderId?: string
  selectedFolderAlias?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
  sidebarWidth: number
  snippetListWidth: number
  version?: string
}

interface Editor {
  fontFamily: string
  fontSize: number
  showInvisibles: boolean
  tabSize: number
  wrap: string
  trailingComma: 'all' | 'none' | 'es5'
  semi: boolean
  singleQuote: boolean
}
export interface PreferencesStore {
  storagePath: string
  backupPath: string
  editor: Editor
}
