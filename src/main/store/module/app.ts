import Store from 'electron-store'
import { STORE_NAME } from '..'
import type { AppStore } from './types'

export default new Store<AppStore>({
  name: 'app',
  cwd: 'v2',

  defaults: {
    bounds: {}
  }
})
