import { contextBridge, ipcRenderer } from 'electron'
import { isDbExist, migrate, migrateFromSnippetsLab, move } from './services/db'
import { store } from './store'
import type { ElectronBridge } from '@shared/types/main'
import { version } from '../../package.json'
import type { TrackEvents } from '@shared/types/main/analytics'
import { analytics } from './services/analytics'
import { platform } from 'os'

const isDev = process.env.NODE_ENV === 'development'

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
    migrate: path => migrate(path),
    migrateFromSnippetsLab: path => migrateFromSnippetsLab(path),
    move: (from, to) => move(from, to),
    isExist: path => isDbExist(path)
  },
  track: (event: TrackEvents, payload?: string) => {
    if (isDev) return

    const path = payload
      ? `${version}/${event}/${payload}`
      : `${version}/${event}`

    analytics.pageview(path).send()
  },
  platform: () => platform()
} as ElectronBridge)
