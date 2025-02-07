import type { EventCallback } from './types'
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    on: (channel: string, cb: EventCallback) => ipcRenderer.on(channel, cb),
    send: (channel: string, data: any, cb: EventCallback) => {
      ipcRenderer.send(channel, data)
      if (cb && typeof cb === 'function') {
        ipcRenderer.on(channel, cb)
      }
    },
    removeListener: (channel: string, cb: EventCallback) =>
      ipcRenderer.removeListener(channel, cb),
    removeListeners: (channel: string) =>
      ipcRenderer.removeAllListeners(channel),
  },
  db: {
    query: (sql: string, params: any[] = []) =>
      ipcRenderer.invoke('db-query', { sql, params }),
  },
})
