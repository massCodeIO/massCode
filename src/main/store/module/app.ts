import Store from 'electron-store'

export interface AppStoreSchema {
  bounds: object
  selectedFolderId?: string
  selectedSnippetId?: string
}

export default new Store<AppStoreSchema>({
  name: 'app',
  cwd: 'massCode',

  defaults: {
    bounds: {}
  }
})
