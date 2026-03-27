/* eslint-disable node/prefer-global/process */
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, protocol } from 'electron'
import { initApi } from './api'
import { registerIPC } from './ipc'
import { startThemeWatcher, stopThemeWatcher } from './ipc/handlers/theme'
import { createMainMenu } from './menu/main'
import { startMarkdownWatcher, stopMarkdownWatcher } from './storage'
import { ensureFlatSpacesLayout } from './storage/providers/markdown/runtime/spaces'
import { store } from './store'
import { checkForUpdates } from './updates'
import { isSqliteFile, log } from './utils'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

const isDev = process.env.NODE_ENV === 'development'
const gotTheLock = app.requestSingleInstanceLock()
const lazyRequire = createRequire(__filename)

let mainWindow: BrowserWindow
let isQuitting = false
let migrationResult: {
  folders: number
  snippets: number
  tags: number
} | null = null
let migrationError: string | null = null

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('masscode', process.execPath, [
      path.resolve(process.argv[1]),
    ])
  }
}
else {
  app.setAsDefaultProtocolClient('masscode')
}

function createWindow() {
  const bounds = store.app.get('bounds')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...bounds,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      webSecurity: false,
    },
  })

  Menu.setApplicationMenu(createMainMenu())

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  }
  else {
    mainWindow.loadFile(
      path.join(__dirname, '../../build/renderer/index.html'),
    )
  }

  ipcMain.once('system:renderer-ready', () => {
    if (migrationResult) {
      mainWindow.webContents.send('system:migration-complete', migrationResult)
    }
    else if (migrationError) {
      mainWindow.webContents.send('system:migration-error', {
        message: migrationError,
      })
    }
  })

  mainWindow.on('close', (event) => {
    store.app.set('bounds', mainWindow.getBounds())

    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      return
    }

    mainWindow.destroy()
  })
}

if (!gotTheLock) {
  app.quit()
}
else {
  app.whenReady().then(async () => {
    protocol.handle('masscode', async (request) => {
      const url = new URL(request.url)

      if (url.hostname === 'notes-asset') {
        const fileName = url.pathname.replace(/^\//, '')
        const vaultPath
          = (store.preferences.get('storage.vaultPath') as string | null)
            || path.join(
              store.preferences.get('storagePath') as string,
              'markdown-vault',
            )
        ensureFlatSpacesLayout(vaultPath)
        const filePath = path.join(vaultPath, 'notes', 'assets', fileName)

        try {
          const data = await readFile(filePath)
          const ext = path.extname(fileName).toLowerCase()
          const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp',
          }
          return new Response(data, {
            headers: {
              'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            },
          })
        }
        catch {
          return new Response('Not found', { status: 404 })
        }
      }

      return new Response('Not found', { status: 404 })
    })

    try {
      const storagePath = store.preferences.get('storagePath')
      const dbPath = `${storagePath}/massCode.db`

      if (isSqliteFile(dbPath)) {
        const vaultPath
          = (store.preferences.get('storage.vaultPath') as string | null)
            || path.join(storagePath, 'markdown-vault')
        ensureFlatSpacesLayout(vaultPath)
        const statePath = path.join(
          vaultPath,
          'code',
          '.masscode',
          'state.json',
        )
        let vaultHasData = false

        try {
          const stateContent = readFileSync(statePath, 'utf8')
          const state = JSON.parse(stateContent) as {
            folders?: unknown[]
            snippets?: unknown[]
            tags?: unknown[]
          }

          vaultHasData = [state.folders, state.snippets, state.tags].some(
            collection => Array.isArray(collection) && collection.length > 0,
          )
        }
        catch {
          // state.json doesn't exist or is invalid; treat the vault as empty
        }

        if (!vaultHasData) {
          const { closeDB } = lazyRequire('./db') as typeof import('./db')
          const { migrateSqliteToMarkdownStorage } = lazyRequire(
            './storage/providers/markdown',
          ) as typeof import('./storage/providers/markdown')

          try {
            migrationResult = migrateSqliteToMarkdownStorage()

            store.preferences.delete('storage.engine' as any)
            store.preferences.delete('backup' as any)

            // eslint-disable-next-line no-console
            console.log('[Auto-migration complete]', migrationResult)
          }
          finally {
            closeDB()
          }
        }
      }
    }
    catch (error) {
      log('Error during auto-migration from SQLite', error)
      migrationError = error instanceof Error ? error.message : String(error)
    }

    try {
      startMarkdownWatcher()
    }
    catch (error) {
      log('Error starting markdown watcher', error)
    }

    try {
      registerIPC()
    }
    catch (error) {
      log('Error registering IPC', error)
    }

    try {
      createWindow()
    }
    catch (error) {
      log('Error creating window', error)
    }

    try {
      startThemeWatcher()
    }
    catch (error) {
      log('Error starting theme watcher', error)
    }

    try {
      await initApi()
    }
    catch (error) {
      log('Error initializing API', error)
    }

    try {
      checkForUpdates()
    }
    catch (error) {
      log('Error checking for updates', error)
    }
  })

  app.on('activate', () => {
    mainWindow.show()
  })

  app.on('before-quit', () => {
    isQuitting = true
    stopThemeWatcher()
    stopMarkdownWatcher()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
      app.quit()
  })

  app.on('second-instance', (_, argv) => {
    if (mainWindow) {
      mainWindow.isMinimized() ? mainWindow.restore() : mainWindow.focus()
    }

    if (process.platform !== 'darwin') {
      const url = argv.find(i => i.startsWith('masscode://'))
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'system:deep-link',
        url,
      )
    }
  })

  app.on('open-url', (_, url) => {
    BrowserWindow.getFocusedWindow()?.webContents.send('system:deep-link', url)
  })

  process.on('uncaughtException', (err) => {
    BrowserWindow.getFocusedWindow()?.webContents.send('system:error', {
      source: 'main',
      message: err.message,
      stack: err.stack,
    })
  })

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason))
    BrowserWindow.getFocusedWindow()?.webContents.send('system:error', {
      source: 'main',
      message: err.message,
      stack: err.stack,
    })
  })
}
