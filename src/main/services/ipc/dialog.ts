import type { MessageBoxRequest } from '@shared/types/main'
import { dialog, ipcMain } from 'electron'

export const subscribeToDialog = () => {
  ipcMain.handle('main:open-dialog', () => {
    return new Promise<string>(resolve => {
      const dir = dialog.showOpenDialogSync({
        properties: ['openDirectory', 'createDirectory']
      })

      if (dir) {
        resolve(dir[0])
      } else {
        resolve('')
      }
    })
  })

  ipcMain.handle<MessageBoxRequest, boolean>(
    'main:open-message-box',
    (event, payload) => {
      const { message, detail, buttons } = payload
      return new Promise(resolve => {
        const buttonId = dialog.showMessageBoxSync({
          message,
          detail,
          buttons,
          defaultId: 0,
          cancelId: 1
        })

        if (buttonId === 0) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    }
  )
}
