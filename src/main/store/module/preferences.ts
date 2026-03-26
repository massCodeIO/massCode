import type { PreferencesStore } from '../types'
import { homedir, platform } from 'node:os'
import Store from 'electron-store'
import { EDITOR_DEFAULTS, NOTES_EDITOR_DEFAULTS } from '../constants'

const isWin = platform() === 'win32'

const storagePath = isWin ? `${homedir()}\\massCode` : `${homedir()}/massCode`

const preferencesStore = new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath,
    apiPort: 4321,
    language: 'en_US',
    theme: 'auto',
    editor: EDITOR_DEFAULTS,
    notesEditor: NOTES_EDITOR_DEFAULTS,
    storage: {
      vaultPath: null,
    },
    markdown: {
      scale: 1,
    },
  },
})

export default preferencesStore
