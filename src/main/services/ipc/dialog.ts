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
}
