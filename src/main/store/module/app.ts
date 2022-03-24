import Store from 'electron-store'

interface StoreSchema {
  bounds: object
}

export default new Store<StoreSchema>({
  name: 'app',
  cwd: 'massCode',

  schema: {
    bounds: {
      default: {},
      type: 'object'
    }
  }
})
