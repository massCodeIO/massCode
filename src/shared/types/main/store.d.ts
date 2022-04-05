export interface AppStore {
  bounds: object
  selectedFolderId?: string
  selectedFolderAlias?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
}
