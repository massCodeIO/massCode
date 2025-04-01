import type { AppStore } from '../types'
import Store from 'electron-store'
import { APP_DEFAULTS } from '../constants'

export default new Store<AppStore>({
  name: 'app',
  cwd: 'v2',

  defaults: {
    bounds: {},
    sizes: {
      sidebarWidth: APP_DEFAULTS.sizes.sidebar,
      snippetListWidth: APP_DEFAULTS.sizes.snippetList,
      tagsListHeight: APP_DEFAULTS.sizes.tagsList,
    },
    state: {},
    isAutoMigratedFromJson: false,
  },
})
