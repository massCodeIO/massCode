export interface AppStore {
  bounds: object
  selectedFolderId?: string
  selectedSnippetId?: string
}

export interface PreferencesStore {
  storagePath: string
  backupPath: string
}
