import Store from 'electron-store'
import { homedir, platform } from 'os'
import type { PreferencesStore } from '@shared/types/main/store'

const isWin = platform() === 'win32'

const defaultPath = isWin ? homedir() + '\\massCode' : homedir() + '/massCode'
const backupPath = isWin ? `${defaultPath}\\backups` : `${defaultPath}/backups`

export default new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath: defaultPath,
    backupPath,
    theme: 'light:github',
    editor: {
      wrap: true,
      fontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
      fontSize: 12,
      tabSize: 2,
      trailingComma: 'none',
      semi: false,
      singleQuote: true,
      highlightLine: false,
      highlightGutter: false
    },
    screenshot: {
      background: false,
      gradient: ['#D02F98', '#9439CA'],
      darkMode: true,
      width: 600
    },
    language: 'en'
  }
})
