import type { Channel } from '../types/ipc'
import { BrowserWindow } from 'electron'
import { registerDBHandlers } from './handlers/db'
import { registerDialogHandlers } from './handlers/dialog'
import { registerFsHandlers } from './handlers/fs'
import { registerPrettierHandlers } from './handlers/prettier'
import { registerSystemHandlers } from './handlers/system'
import { registerThemeHandlers } from './handlers/theme'

export function send(channel: Channel, payload?: unknown) {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel, payload)
}

export function registerIPC() {
  registerDialogHandlers()
  registerDBHandlers()
  registerSystemHandlers()
  registerPrettierHandlers()
  registerFsHandlers()
  registerThemeHandlers()
}
