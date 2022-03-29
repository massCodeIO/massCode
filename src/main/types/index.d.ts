import type { IpcRendererEvent } from 'electron'
import type { AppStoreSchema } from '../store/module/app'
import type { DB, Folder, Tag, Snippet } from './db'

interface EventCallback {
  (event?: IpcRendererEvent, ...args: any[]): void
}

export interface ElectronBridge {
  ipc: {
    on: (channel: string, cb: EventCallback) => void
    send: (channel: string, data: any, cb: EventCallback) => void
    removeListener: (channel: string, cb: EventCallback) => void
    removeListeners: (channel: string) => void
  }
  store: {
    app: {
      get: (name: keyof AppStoreSchema) => string
      set: (name: keyof AppStoreSchema, value: any) => void
    }
  }
  db: {
    migrate: (path: string) => void
    updateTable: (
      key: keyof DB,
      data: Folder[] | Snippet[] | Tag[],
      db: DB
    ) => void
  }
}

declare global {
  interface Window {
    electron: ElectronBridge
  }
}
