import axios from 'axios'
import { BrowserWindow } from 'electron'
import { version, repository } from '../../../package.json'

const isDev = process.env.NODE_ENV === 'development'

export const checkForUpdate = async () => {
  if (isDev) return

  try {
    const res = await axios.get(`${repository}/releases/latest`)

    if (res) {
      const latest = res.request.socket._httpMessage.path
        .split('/')
        .pop()
        .substring(1)
      if (latest !== version) {
        BrowserWindow.getFocusedWindow()?.webContents.send(
          'main:update-available'
        )
        return latest
      }
    }
  } catch (err) {
    console.error(err)
  }
}
