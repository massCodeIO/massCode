/* eslint-disable node/prefer-global/process */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, Menu } from 'electron'
import { initApi } from './api'
import { migrateJsonToSqlite } from './db/migrate'
import { registerIPC } from './ipc'
import { mainMenu } from './menu/main'
import { store } from './store'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true' // Отключаем security warnings

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow
let isQuitting = false

function createWindow() {
  const bounds = store.app.get('bounds')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...bounds,
    titleBarStyle: 'hidden',
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

    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
    else {
      mainWindow.destroy()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  registerIPC()

  initApi()

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
