import type { AppStore, PreferencesStore } from '../store/module/types'
import type { DB, Folder, Tag, Snippet } from './db'

type ChannelSubject = 'snippet' | 'snippet-fragment' | 'folder'

type ContextMenuAction =
  | 'rename'
  | 'delete'
  | 'duplicate'
  | 'favorites'
  | 'none'

export type ContextMenuType = 'folder' | 'inbox' | 'all' | 'trash' | 'favorites'

type CombineWithChannelSubject<
  T extends ChannelSubject,
  U extends string
> = `${U}:${T}`

export type ContextMenuChannel = CombineWithChannelSubject<
ChannelSubject,
'context-menu'
>

export type Channel = 'restart' | ContextMenuChannel
export interface ContextMenuPayload {
  name?: string
  type: ContextMenuType
}

export interface ContextMenuResponse {
  action: ContextMenuAction
  type: ContextMenuType
  data: any
}

interface StoreGet<T> {
  (name: keyof T): any
}

interface StoreSet<T> {
  (name: keyof T, value: any): void
}

interface StoreProperties<T> {
  get: StoreGet<T>
  set: StoreSet<T>
  delete: StoreGet<T>
}

export interface ElectronBridge {
  ipc: {
    invoke<T, U>(channel: Channel, payload: U): Promise<T>
  }
  store: {
    app: StoreProperties<AppStore>
    preferences: StoreProperties<PreferencesStore>
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
