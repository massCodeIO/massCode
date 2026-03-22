import { Buffer } from 'node:buffer'
import { join, parse } from 'node:path'
import { ipcMain } from 'electron'
import { ensureDirSync, writeFileSync } from 'fs-extra'
import { nanoid } from 'nanoid'
import slash from 'slash'
import { store } from '../../store'

const ASSETS_DIR = 'assets'

export function registerFsHandlers() {
  ipcMain.handle('fs:assets', (event, { buffer, fileName }) => {
    const storagePath = store.preferences.get('storagePath')

    return new Promise((resolve, reject) => {
      try {
        const assetsPath = join(storagePath, ASSETS_DIR)

        const { ext } = parse(fileName)
        const name = `${nanoid()}${ext}`
        const dest = join(assetsPath, name)

        ensureDirSync(assetsPath)
        writeFileSync(dest, Buffer.from(buffer))

        resolve(slash(join(ASSETS_DIR, name)))
      }
      catch (error) {
        reject(error)
      }
    })
  })

  ipcMain.handle('fs:notes-asset', (event, { buffer, ext }) => {
    const vaultPath
      = (store.preferences.get('storage.vaultPath') as string | null)
        || join(store.preferences.get('storagePath') as string, 'markdown-vault')

    return new Promise((resolve, reject) => {
      try {
        const assetsPath = join(vaultPath, '__spaces__', 'notes', 'assets')
        const name = `${nanoid()}${ext}`
        const dest = join(assetsPath, name)

        ensureDirSync(assetsPath)
        writeFileSync(dest, Buffer.from(buffer))

        resolve(`masscode://notes-asset/${name}`)
      }
      catch (error) {
        reject(error)
      }
    })
  })
}
