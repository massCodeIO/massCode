import type { Channel } from '../types/ipc'
import type { MainMenuContext } from '../types/menu'
import { createRequire } from 'node:module'
import { BrowserWindow, ipcMain } from 'electron'
import i18n from '../i18n'
import { updateMainMenu } from '../menu/main'
import { getVaultPath } from '../storage/providers/markdown/runtime'
import { store } from '../store'
import { isSqliteFile } from '../utils'
import { registerDialogHandlers } from './handlers/dialog'
import { registerFsHandlers } from './handlers/fs'
import { registerHttpHandlers } from './handlers/http'
import { registerHttpPreviewHandlers } from './handlers/httpPreview'
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
  registerHttpPreviewHandlers()

  ipcMain.on('main-menu:update-context', (_, payload: MainMenuContext) => {
    updateMainMenu(payload)
  })

  ipcMain.handle(
    'db:migrate-to-markdown',
    async (_, payload?: string | { path: string, expectedVault: string }) => {
      if (
        typeof payload === 'object'
        && (!payload || payload.expectedVault !== getVaultPath())
      ) {
        throw new Error(i18n.t('ai.native.stale'))
      }
      const sqliteDbPath = typeof payload === 'object' ? payload.path : payload
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
    },
  )
}
