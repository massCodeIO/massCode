import type { IpcRendererEvent } from 'electron'
import type { AppStore, PreferencesStore } from '../store/module/types'
import type { DB, Folder, Tag, Snippet, FolderTree } from './db'

type ChannelSubject = 'snippet' | 'snippet-fragment' | 'folder' | 'close'

type ContextMenuAction =
  | 'rename'
  | 'delete'
  | 'duplicate'
  | 'favorites'
  | 'new'
  | 'update:language'
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

export type Channel = 'restart' | 'notification' | ContextMenuChannel
export interface ContextMenuPayload {
  name?: string
  type: ContextMenuType
  data?: any
  selectedCount?: number
}

export interface ContextMenuResponse {
  action: ContextMenuAction
  type: ContextMenuType
  data: any
}

export interface NotificationPayload {
  body: string
}

interface EventCallback {
  (event?: IpcRendererEvent, ...args: any[]): void
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
    invoke<T, U = any>(channel: Channel, payload: U): Promise<T>
    on(channel: Channel, cb: EventCallback): void
    once(channel: Channel, cb: EventCallback): void
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
