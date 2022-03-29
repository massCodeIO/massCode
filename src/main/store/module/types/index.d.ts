export interface AppStore {
  bounds: object
  selectedFolderId?: string
  selectedFolderIds?: string[]
  selectedSnippetId?: string
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
}
