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
  store: {
    app: {
      get: <T = unknown>(name: string) => store.app.get(name) as T,
      set: (name: string, value: unknown) => store.app.set(name, value),
      delete: (name: string) => store.app.delete(name as any),
    },
    preferences: {
      get: <T = unknown>(name: string) => store.preferences.get(name) as T,
      set: (name: string, value: unknown) => store.preferences.set(name, value),
      delete: (name: string) => store.preferences.delete(name as any),
    },
    mathNotebook: {
      get: <T = unknown>(name: string) => store.mathNotebook.get(name) as T,
      set: (name: string, value: unknown) =>
        store.mathNotebook.set(name, value),
      delete: (name: string) => store.mathNotebook.delete(name as any),
    },
  },
  i18n: {
    t: (key: string, options?: any) => i18n.t(key, options),
  },
})
