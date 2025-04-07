import { app, ipcMain } from 'electron'

export function registerSystemHandlers() {
  ipcMain.handle('system:reload', () => {
    app.relaunch()
    app.quit()
  })
}
