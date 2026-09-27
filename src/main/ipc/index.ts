import type { Channel } from '../types/ipc'
import type { MainMenuContext } from '../types/menu'
import { BrowserWindow, ipcMain } from 'electron'
import { updateMainMenu } from '../menu/main'
import { registerDialogHandlers } from './handlers/dialog'
import { registerFsHandlers } from './handlers/fs'
import { registerHttpHandlers } from './handlers/http'
import { registerHttpPreviewHandlers } from './handlers/httpPreview'
import { registerPrettierHandlers } from './handlers/prettier'
import { registerSpacesHandlers } from './handlers/spaces'
import { registerSystemHandlers } from './handlers/system'
import { registerThemeHandlers } from './handlers/theme'

export function send(channel: Channel, payload?: unknown) {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel, payload)
}

export function registerIPC() {
  registerDialogHandlers()
  registerSystemHandlers()
  registerPrettierHandlers()
  registerFsHandlers()
  registerThemeHandlers()
  registerSpacesHandlers()
  registerHttpHandlers()
  registerHttpPreviewHandlers()

  ipcMain.on('main-menu:update-context', (_, payload: MainMenuContext) => {
    updateMainMenu(payload)
  })
}
