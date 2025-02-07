import Store from 'electron-store'

interface StoreSchema {
  bounds: object
}

export default new Store<StoreSchema>({
  name: 'app',
  schema: {
    bounds: {
      default: {},
      type: 'object',
    },
  },
})
