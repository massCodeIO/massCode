import type { DialogOptions } from '../../types/ipc'
import { BrowserWindow, dialog, ipcMain } from 'electron'

export function registerDialogHandlers() {
  ipcMain.handle<DialogOptions>('main-menu:open-dialog', (event, payload) => {
    return new Promise<string>((resolve) => {
      const { properties, filters } = payload

      const dir = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow()!, {
        properties: properties || ['openDirectory', 'createDirectory'],
        filters: filters || [{ name: '*', extensions: ['.db'] }],
      })

      if (dir) {
        resolve(dir[0])
      }
      else {
        resolve('')
      }
    })
  })
}
