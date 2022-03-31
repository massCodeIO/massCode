import Store from 'electron-store'
import { homedir, platform } from 'os'
import { STORE_NAME } from '..'
import type { PreferencesStore } from './types'

const isDev = process.env.NODE_ENV === 'development'
const isWin = platform() === 'win32'

const prodPath = isWin ? homedir() + '\\massCode' : homedir() + '/massCode'
const devPath = isWin
  ? homedir() + '\\massCode\\dev'
  : homedir() + '/massCode/dev'

const defaultPath = isDev ? devPath : prodPath
const backupPath = isWin ? `${defaultPath}\\backups` : `${defaultPath}/backups`

export default new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath: defaultPath,
    backupPath
  }
})
