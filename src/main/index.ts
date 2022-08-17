import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import path from 'path'
import os from 'os'
import { store } from './store'
import { ApiServer } from './services/api/server'
import { createDb } from './services/db'
import { debounce } from 'lodash'
import { subscribeToChannels } from './services/ipc'
import { mainMenu } from './menu/main'
import { subscribeToDialog } from './services/ipc/dialog'
import { checkForUpdateWithInterval } from './services/update-check'

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const gotTheLock = app.requestSingleInstanceLock()

let mainWindow: BrowserWindow

createDb()
const apiServer = new ApiServer()

subscribeToChannels()
subscribeToDialog()

if (!gotTheLock) {
  // @ts-ignore
  return app.quit()
}

function createWindow () {
  const bounds = store.app.get('bounds')
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    ...bounds,
    titleBarStyle: isMac ? 'hidden' : 'default',
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false
    }
  })

  Menu.setApplicationMenu(mainMenu)

  if (isDev) {
    const rendererPort = process.argv[2]
    mainWindow.loadURL(`http://localhost:${rendererPort}`)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.resolve(app.getAppPath(), 'renderer/index.html'))
  }

  mainWindow.on('resize', () => storeBounds(mainWindow))
  mainWindow.on('move', () => storeBounds(mainWindow))

  checkForUpdateWithInterval()
}

const storeBounds = debounce((mainWindow: BrowserWindow) => {
  store.app.set('bounds', mainWindow.getBounds())
}, 300)

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('masscode', process.execPath, [
      path.resolve(process.argv[1])
    ])
  }
} else {
  app.setAsDefaultProtocolClient('masscode')
}

app.whenReady().then(async () => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('browser-window-focus', () => {
  BrowserWindow.getFocusedWindow()?.webContents.send('main:focus')
})

app.on('second-instance', (e, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }

  if (process.platform !== 'darwin') {
    const url = argv.find(i => i.startsWith('masscode://'))
    BrowserWindow.getFocusedWindow()?.webContents.send('main:app-protocol', url)
  }
})

app.on('open-url', (event, url) => {
  BrowserWindow.getFocusedWindow()?.webContents.send('main:app-protocol', url)
})

ipcMain.handle('main:restart-api', () => {
  apiServer.restart()
})

ipcMain.handle('main:restart', () => {
  app.relaunch()
  app.quit()
})

ipcMain.handle('main:open-url', (event, payload) => {
  shell.openExternal(payload as string)
})

ipcMain.on('request-info', event => {
  event.sender.send('request-info', {
    version: app.getVersion(),
    arch: os.arch(),
    platform: process.platform
  })
})
