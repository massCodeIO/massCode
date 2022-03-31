import Store from 'electron-store'
import { homedir, platform } from 'os'
import type { PreferencesStore } from './types'

const isWin = platform() === 'win32'

const defaultPath = isWin ? homedir() + '\\massCode' : homedir() + '/massCode'
const backupPath = isWin ? `${defaultPath}\\backups` : `${defaultPath}/backups`

export default new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath: defaultPath,
    backupPath
  }
})
