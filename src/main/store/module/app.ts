import Store from 'electron-store'

export interface AppStoreSchema {
  bounds: object
}

export default new Store<AppStoreSchema>({
  name: 'app',
  cwd: 'massCode',

  defaults: {
    bounds: {}
  }
})
