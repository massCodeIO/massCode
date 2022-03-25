import { contextBridge, ipcRenderer } from 'electron'
import { store } from './store'
import type { ElectronBridge } from './types'

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    on: (channel, cb) => ipcRenderer.on(channel, cb),
    send: (channel, data, cb) => {
      ipcRenderer.send(channel, data)
      if (cb && typeof cb === 'function') {
        ipcRenderer.on(channel, cb)
      }
    },
    removeListener: (channel, cb) => ipcRenderer.removeListener(channel, cb),
    removeListeners: channel => ipcRenderer.removeAllListeners(channel)
  },
  store: {
    app: {
      get: name => store.app.get(name),
      set: (name, value) => store.app.set(name, value)
    }
  }
} as ElectronBridge)
