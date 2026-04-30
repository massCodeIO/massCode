import type { Channel } from '../types/ipc'
import type { MainMenuContext } from '../types/menu'
import { createRequire } from 'node:module'
import { BrowserWindow, ipcMain } from 'electron'
import { updateMainMenu } from '../menu/main'
import { store } from '../store'
import { isSqliteFile } from '../utils'
import { registerDialogHandlers } from './handlers/dialog'
import { registerFsHandlers } from './handlers/fs'
import { registerHttpHandlers } from './handlers/http'
import { registerPrettierHandlers } from './handlers/prettier'
import { registerSpacesHandlers } from './handlers/spaces'
import { registerSystemHandlers } from './handlers/system'
import { registerThemeHandlers } from './handlers/theme'

const lazyRequire = createRequire(__filename)

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

  ipcMain.on('main-menu:update-context', (_, payload: MainMenuContext) => {
    updateMainMenu(payload)
  })

  ipcMain.handle('db:migrate-to-markdown', async (_, sqliteDbPath?: string) => {
    const storagePath = store.preferences.get('storage.rootPath') as string
    const dbPath
      = typeof sqliteDbPath === 'string' && sqliteDbPath.trim()
        ? sqliteDbPath
        : `${storagePath}/massCode.db`

    if (!isSqliteFile(dbPath)) {
      throw new Error(
        'No valid massCode.db found. '
        + 'Select a massCode.db file from a previous version and try again.',
      )
    }

    const { closeDB } = lazyRequire('../db') as typeof import('../db')
    const { migrateSqliteToMarkdownStorage } = lazyRequire(
      '../storage/providers/markdown',
    ) as typeof import('../storage/providers/markdown')

    try {
      return migrateSqliteToMarkdownStorage(dbPath)
    }
    finally {
      closeDB()
    }
  })
}
