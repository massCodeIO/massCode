import Store from 'electron-store'

interface StoreSchema {
  bounds: object
  isAutoMigratedFromJson: boolean
}

export default new Store<StoreSchema>({
  name: 'app',
  cwd: 'v2',

  defaults: {
    bounds: {},
    isAutoMigratedFromJson: false,
  },
})
