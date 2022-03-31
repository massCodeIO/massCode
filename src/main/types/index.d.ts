import type { AppStore, PreferencesStore } from '../store/module/types'
import type { DB, Folder, Tag, Snippet } from './db'

interface EventCallback {
  (event?: IpcRendererEvent, ...args: any[]): void
}

interface StoreGet<T> {
  (name: keyof T): any
}

interface StoreSet<T> {
  (name: keyof T, value: any): void
}

export interface ElectronBridge {
  ipc: {
    invoke<T, U>(channel: Channel, payload: U): Promise<T>
  }
  store: {
    app: {
      get: StoreGet<AppStore>
      set: StoreSet<AppStore>
    }
    preferences: {
      get: StoreGet<PreferencesStore>
      set: StoreSet<PreferencesStore>
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
