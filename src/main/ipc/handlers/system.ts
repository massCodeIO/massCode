import { app, ipcMain, shell } from 'electron'

export function registerSystemHandlers() {
  ipcMain.handle('system:reload', () => {
    app.relaunch()
    app.quit()
  })

  ipcMain.handle('system:open-external', (_, url: string) => {
    shell.openExternal(url)
  })
}
