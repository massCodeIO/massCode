import Store from 'electron-store'
import { homedir, platform } from 'os'

const isDev = process.env.NODE_ENV === 'development'
const isWin = platform() === 'win32'

const prodPath = isWin ? homedir() + '\\massCode' : homedir() + '/massCode'
const devPath = isWin
  ? homedir() + '\\massCode\\dev'
  : homedir() + '/massCode/dev'

const defaultPath = isDev ? devPath : prodPath
const backupPath = isWin ? `${defaultPath}\\backups` : `${defaultPath}/backups`

interface StoreSchema {
  storagePath: string
  backupPath: string
}

export default new Store<StoreSchema>({
  name: 'preferences',
  cwd: 'massCode',

  schema: {
    storagePath: {
      default: defaultPath
    },
    backupPath: {
      default: backupPath
    }
  }
})
