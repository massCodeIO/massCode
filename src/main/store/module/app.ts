import Store from 'electron-store'
import type { AppStore } from '@shared/types/main/store'

export default new Store<AppStore>({
  name: 'app',
  cwd: 'v2',

  defaults: {
    bounds: {}
  }
})
