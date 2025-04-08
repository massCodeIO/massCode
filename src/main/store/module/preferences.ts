import type { PreferencesStore } from '../types'
import { homedir, platform } from 'node:os'
import Store from 'electron-store'

const isWin = platform() === 'win32'

const storagePath = isWin ? `${homedir()}\\massCode` : `${homedir()}/massCode`
const backupPath = isWin ? `${storagePath}\\backups` : `${storagePath}/backups`

export default new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath,
    backupPath,
    apiPort: 4321,
    language: 'en_US',
    theme: 'auto',
    editor: {
      fontSize: 13,
      fontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
      wrap: false,
      tabSize: 2,
      trailingComma: 'all',
      semi: false,
      singleQuote: false,
      highlightLine: false,
      matchBrackets: true,
    },
  },
})
