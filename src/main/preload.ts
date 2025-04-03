import type { AppStore, PreferencesStore } from './store/types'
import type { EventCallback } from './types'
import type { Channel } from './types/ipc'
import { contextBridge, ipcRenderer } from 'electron'
import i18n from './i18n'
import { store } from './store'

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    on: (channel: Channel, cb: EventCallback) => ipcRenderer.on(channel, cb),
    send: (channel: Channel, data: any, cb: EventCallback) => {
      ipcRenderer.send(channel, data)
      if (cb && typeof cb === 'function') {
        ipcRenderer.on(channel, cb)
      }
    },
    invoke: (channel: Channel, data: any) => ipcRenderer.invoke(channel, data),
    removeListener: (channel: Channel, cb: EventCallback) =>
      ipcRenderer.removeListener(channel, cb),
    removeListeners: (channel: Channel) =>
      ipcRenderer.removeAllListeners(channel),
  },
  db: {
    query: (sql: string, params: any[] = []) =>
      ipcRenderer.invoke('db-query', { sql, params }),
  },
  store: {
    app: {
      get: (name: keyof AppStore) => store.app.get(name),
      set: <T extends keyof AppStore>(name: T, value: AppStore[T]) =>
        store.app.set(name, value),
      delete: (name: keyof AppStore) => store.app.delete(name),
    },
    preferences: {
      get: (name: keyof PreferencesStore) => store.preferences.get(name),
      set: <T extends keyof PreferencesStore>(
        name: T,
        value: PreferencesStore[T],
      ) => store.preferences.set(name, value),
      delete: (name: keyof PreferencesStore) => store.preferences.delete(name),
    },
  },
  i18n: {
    t: (key: string, options?: any) => i18n.t(key, options),
  },
})
