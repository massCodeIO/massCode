import type { Channel } from '../types/ipc'
import { createRequire } from 'node:module'
import { BrowserWindow, ipcMain } from 'electron'
import { store } from '../store'
import { isSqliteFile } from '../utils'
import { registerDialogHandlers } from './handlers/dialog'
import { registerFsHandlers } from './handlers/fs'
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

  ipcMain.handle('db:migrate-to-markdown', async () => {
    const storagePath = store.preferences.get('storagePath')
    const dbPath = `${storagePath}/massCode.db`

    if (!isSqliteFile(dbPath)) {
      throw new Error(
        'No valid massCode.db found in storage path. '
        + 'Place a massCode.db file from a previous version into '
        + `"${storagePath}" and try again.`,
      )
    }

    const { closeDB } = lazyRequire('../db') as typeof import('../db')
    const { migrateSqliteToMarkdownStorage } = lazyRequire(
      '../storage/providers/markdown',
    ) as typeof import('../storage/providers/markdown')

    try {
      return migrateSqliteToMarkdownStorage()
    }
    finally {
      closeDB()
    }
  })
}
