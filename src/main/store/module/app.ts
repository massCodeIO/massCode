import Store from 'electron-store'
import type { AppStore } from './types'

export default new Store<AppStore>({
  name: 'app',
  cwd: 'v2',

  defaults: {
    bounds: {}
  }
})
