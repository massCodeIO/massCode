import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import os from 'os'
import { store } from './store'
import { createApiServer } from './services/api/server'
import { createDb } from './services/db'
import { debounce } from 'lodash'
import { subscribeToChannels } from './services/ipc'

const isDev = process.env.NODE_ENV === 'development'

createDb()
createApiServer()
subscribeToChannels()

function createWindow () {
  if (isDev) {
    store.preferences.set('storagePath', os.homedir() + '/massCode/dev')
    store.preferences.set('backupPath', os.homedir() + '/massCode/dev')
  }

  const bounds = store.app.get('bounds')
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    ...bounds,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false
    }
  })

  if (isDev) {
    const rendererPort = process.argv[2]
    mainWindow.loadURL(`http://localhost:${rendererPort}`)
  } else {
    mainWindow.loadFile(path.resolve(app.getAppPath(), 'renderer/index.html'))
  }

  mainWindow.on('resize', () => storeBounds(mainWindow))
  mainWindow.on('move', () => storeBounds(mainWindow))
}

const storeBounds = debounce((mainWindow: BrowserWindow) => {
  store.app.set('bounds', mainWindow.getBounds())
}, 300)

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

ipcMain.handle('restart', () => {
  console.log('App is restart...')
  app.relaunch()
  app.exit()
})

ipcMain.on('request-info', event => {
  event.sender.send('request-info', {
    version: app.getVersion(),
    arch: os.arch(),
    platform: process.platform
  })
})
