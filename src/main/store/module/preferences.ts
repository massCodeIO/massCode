import type { PreferencesStore } from '../types'
import { homedir, platform } from 'node:os'
import Store from 'electron-store'
import { EDITOR_DEFAULTS } from '../constants'

const isWin = platform() === 'win32'

const storagePath = isWin ? `${homedir()}\\massCode` : `${homedir()}/massCode`
const backupPath = isWin ? `${storagePath}\\backups` : `${storagePath}/backups`

export default new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath,
    apiPort: 4321,
    language: 'en_US',
    theme: 'auto',
    editor: EDITOR_DEFAULTS,
    markdown: {
      scale: 1,
    },
    backup: {
      path: backupPath,
      enabled: true,
      interval: 6,
      maxBackups: 5,
    },
  },
})
