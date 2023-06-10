import { contextBridge, ipcRenderer } from 'electron'
import {
  isDbExist,
  migrate,
  migrateFromSnippetsLab,
  move,
  createDb
} from './services/db'
import { store } from './store'
import type { ElectronBridge } from '@shared/types/main'
import { platform } from 'os'
import i18n from './services/i18n'
import { version } from '../../package.json'

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
    create: () => createDb(),
    migrate: path => migrate(path),
    migrateFromSnippetsLab: path => migrateFromSnippetsLab(path),
    move: (from, to) => move(from, to),
    isExist: path => isDbExist(path)
  },
  i18n: {
    t: (key, options) => i18n.t(key, options)
  },
  platform: () => platform(),
  version
} as ElectronBridge)
