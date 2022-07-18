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
    customLanguages: [],
    storagePath: defaultPath,
    backupPath,
    theme: 'light:chrome',
    editor: {
      wrap: 'free',
      fontFamily: 'SF Mono, Consolas, Menlo',
      fontSize: 12,
      showInvisibles: false,
      tabSize: 2,
      trailingComma: 'none',
      semi: false,
      singleQuote: true,
      theme: 'chrome',
      highlightLine: false,
      highlightGutter: false
    },
    screenshot: {
      background: false,
      gradient: ['#D02F98', '#9439CA'],
      darkMode: true,
      width: 600
    }
  }
})
