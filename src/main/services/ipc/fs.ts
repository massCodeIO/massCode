import { ipcMain } from 'electron'
import { readFileSync } from 'fs-extra'
import { join } from 'path'

const STATIC_PATH = '../../../static'

export const subscribeToFs = () => {
  interface Payload {
    path: string
    encoding?: BufferEncoding
  }
  ipcMain.handle('main:fs-read', (event, payload: Payload) => {
    const { path, encoding } = payload
    return new Promise(resolve => {
      const file = readFileSync(
        join(__dirname, STATIC_PATH) + path,
        encoding || null
      )

      resolve(file)
    })
  })
}
