import { contextBridge, ipcRenderer } from 'electron'
import { migrate, updateTable } from './services/db'
import { store } from './store'
import type { ElectronBridge } from '@shared/types/main'

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
    on: (channel, cb) => ipcRenderer.on(channel, cb),
    once: (channel, cb) => ipcRenderer.once(channel, cb)
  },
  store: {
    app: {
      get: name => store.app.get(name),
      set: (name, value) => store.app.set(name, value),
      delete: name => store.app.delete(name)
    },
    preferences: {
      get: name => store.preferences.get(name),
      set: (name, value) => store.preferences.set(name, value),
      delete: name => store.preferences.delete(name)
    }
  },
  db: {
    migrate: (path: string) => migrate(path),
    updateTable: (key, data, db) => updateTable(key, data, db)
  }
} as ElectronBridge)
