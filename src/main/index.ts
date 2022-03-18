import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import os from 'os'
import { store } from './store'

const isDev = process.env.NODE_ENV === 'development'

function createWindow () {
  const bounds = store.app.get('bounds')
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    ...bounds,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  if (isDev) {
    const rendererPort = process.argv[2]
    mainWindow.loadURL(`http://localhost:${rendererPort}`)
  } else {
    mainWindow.loadFile(path.resolve(app.getAppPath(), 'renderer/index.html'))
  }

  mainWindow.on('close', () => {
    store.app.set('bounds', mainWindow.getBounds())
  })
}

app.whenReady().then(async () => {
  if (isDev) {
    const { default: installExtension, VUEJS3_DEVTOOLS } = await import(
      'electron-devtools-installer'
    )
    installExtension(VUEJS3_DEVTOOLS)
  }

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

// Demo IPC communication
ipcMain.on('message', (event, message) => {
  console.log(message)
})

ipcMain.on('request-info', event => {
  event.sender.send('request-info', {
    version: app.getVersion(),
    arch: os.arch(),
    platform: process.platform
  })
})
