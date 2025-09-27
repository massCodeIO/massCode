/* eslint-disable node/prefer-global/process */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, Menu } from 'electron'
import { initApi } from './api'
import { startAutoBackup } from './db'
import { migrateJsonToSqlite } from './db/migrate'
import { registerIPC } from './ipc'
import { mainMenu } from './menu/main'
import { store } from './store'
import { checkForUpdates } from './updates'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true' // Отключаем security warnings

const isDev = process.env.NODE_ENV === 'development'
const gotTheLock = app.requestSingleInstanceLock()

let mainWindow: BrowserWindow
let isQuitting = false

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

  Menu.setApplicationMenu(mainMenu)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  }
  else {
    mainWindow.loadFile(
      path.join(__dirname, '../../build/renderer/index.html'),
    )
  }

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
  app.whenReady().then(() => {
    createWindow()
    registerIPC()
    initApi()
    checkForUpdates()
    startAutoBackup()

    if (store.app.get('isAutoMigratedFromJson')) {
      return
    }

    try {
      const jsonDbPath = `${store.preferences.get('storagePath')}/db.json`
      const jsonData = readFileSync(jsonDbPath, 'utf8')

      migrateJsonToSqlite(JSON.parse(jsonData))
      store.app.set('isAutoMigratedFromJson', true)
    }
    catch (err) {
      console.error('Error on auto migration JSON to SQLite:', err)
    }
  })

  app.on('activate', () => {
    mainWindow.show()
  })

  app.on('before-quit', () => {
    isQuitting = true
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
}
