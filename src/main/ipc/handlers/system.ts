import { app, ipcMain, shell } from 'electron'
import { getCurrencyRates } from '../../currencyRates'

export function registerSystemHandlers() {
  ipcMain.handle('system:currency-rates', () => {
    return getCurrencyRates()
  })

  ipcMain.handle('system:reload', () => {
    app.relaunch()
    app.quit()
  })

  ipcMain.handle('system:open-external', (_, url: string) => {
    shell.openExternal(url)
  })
}
