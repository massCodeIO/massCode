/* eslint-disable node/prefer-global/process */
import type Database from 'better-sqlite3'
import type { DBQueryArgs } from './types'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { initApi } from './api'
import { useDB } from './db'
import { migrateJsonToSqlite } from './db/migrate'
import { registerIPC } from './ipc'
import { store } from './store'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true' // Отключаем security warnings

const isDev = process.env.NODE_ENV === 'development'

let db: Database.Database
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
    },
  })

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

  db = useDB()
  initApi()

  if (store.app.get('isAutoMigratedFromJson')) {
    return
  }

  try {
    const jsonDbPath = `${store.preferences.get('storagePath')}/db.json`
    const jsonData = readFileSync(jsonDbPath, 'utf8')

    migrateJsonToSqlite(JSON.parse(jsonData), db)
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

ipcMain.on('message', (event, message) => {
  // eslint-disable-next-line no-console
  console.log(message)
})

ipcMain.on('request-info', (event) => {
  event.sender.send('request-info', {
    version: app.getVersion(),
    arch: os.arch(),
    platform: process.platform,
  })
})

ipcMain.handle('db-query', async (event, args: DBQueryArgs) => {
  const { sql, params = [] } = args

  const stmt = db.prepare(sql)
  const trimmedSql = sql.trim()

  if (/^(?:INSERT|UPDATE|DELETE)/i.test(trimmedSql)) {
    return stmt.run(params)
  }

  if (/^SELECT|WITH/i.test(trimmedSql)) {
    return stmt.all(params)
  }

  throw new Error('Unsupported query type')
})
