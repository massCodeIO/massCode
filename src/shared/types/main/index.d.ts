import type { IpcRendererEvent } from 'electron'
import type { AppStore, PreferencesStore } from './store'
import type { DB, Folder, Tag, Snippet, FolderTree } from './db'

type CombineWith<T extends string, U extends string> = `${U}:${T}`

type ChannelSubject =
  | 'snippet'
  | 'snippet-fragment'
  | 'folder'
  | 'tag'
  | 'library'
  | 'close'

type ContextMenuAction =
  | 'rename'
  | 'delete'
  | 'duplicate'
  | 'favorites'
  | 'new'
  | 'update:language'
  | 'none'

export type ContextMenuType =
  | 'folder'
  | 'inbox'
  | 'all'
  | 'trash'
  | 'favorites'
  | 'tag'

type MainMenuAction = 'preferences' | 'new-snippet'

type MainAction = 'restart' | 'restart-api' | 'notification' | 'open-dialog'

export type ContextMenuChannel = CombineWith<ChannelSubject, 'context-menu'>

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type MainChannel = CombineWith<MainAction, 'main'>

export type Channel = ContextMenuChannel | MainMenuChannel | MainChannel
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
    move: (from: string, to: string) => Promise<void>
    isExist: (path: string) => boolean
  }
}
