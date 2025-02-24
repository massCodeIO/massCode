import { homedir, platform } from 'node:os'
import Store from 'electron-store'

interface StoreSchema {
  storagePath: string
  backupPath: string
  apiPort: number
}

const isWin = platform() === 'win32'

const storagePath = isWin ? `${homedir()}\\massCode` : `${homedir()}/massCode`
const backupPath = isWin ? `${storagePath}\\backups` : `${storagePath}/backups`

export default new Store<StoreSchema>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath,
    backupPath,
    apiPort: 4321,
  },
})
