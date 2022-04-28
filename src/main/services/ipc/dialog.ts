import type { DialogRequest, MessageBoxRequest } from '@shared/types/main'
import { BrowserWindow, dialog, ipcMain } from 'electron'

export const subscribeToDialog = () => {
  ipcMain.handle<DialogRequest, any>('main:open-dialog', (event, payload) => {
    return new Promise<string>(resolve => {
      const { properties, filters } = payload

      const dir = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow()!, {
        properties: properties || ['openDirectory', 'createDirectory'],
        filters: filters || [{ name: '*', extensions: ['json'] }]
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
        const buttonId = dialog.showMessageBoxSync(
          BrowserWindow.getFocusedWindow()!,
          {
            message,
            detail,
            buttons,
            defaultId: 0,
            cancelId: 1
          }
        )

        if (buttonId === 0) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    }
  )
}
