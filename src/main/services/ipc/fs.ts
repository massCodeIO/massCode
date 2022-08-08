import { store } from '../../store'
import { ipcMain } from 'electron'
import { ensureDirSync, copySync } from 'fs-extra'
import { join, parse } from 'path'
import { nanoid } from 'nanoid'
import slash from 'slash'

const ASSETS_DIR = 'assets'

export const subscribeToFs = () => {
  ipcMain.handle<string, string>('main:copy-to-assets', (event, payload) => {
    return new Promise(resolve => {
      const storagePath = store.preferences.get('storagePath')
      const payloadPath = payload
      const assetsPath = join(storagePath, ASSETS_DIR)
      const { ext } = parse(payloadPath)

      const name = `${nanoid()}${ext}`
      const dest = join(assetsPath, name)

      ensureDirSync(assetsPath)
      copySync(payloadPath, dest)

      resolve(slash(join(ASSETS_DIR, name)))
    })
  })
}
