import type { IpcRendererEvent, OpenDialogOptions } from 'electron'
import type { TrackEvents } from '../main/analytics'
import type { AppStore, PreferencesStore } from './store'

export type CombineWith<T extends string, U extends string> = `${U}:${T}`

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

type MainMenuAction =
  | 'preferences'
  | 'new-snippet'
  | 'copy-snippet'
  | 'format-snippet'
  | 'new-fragment'
  | 'new-folder'
  | 'search'
  | 'preview-markdown'

type MainAction =
  | 'restart'
  | 'restart-api'
  | 'notification'
  | 'open-dialog'
  | 'open-message-box'
  | 'update-available'
  | 'open-url'
  | 'prettier'

type ApiAction = 'snippet-create'

export type ContextMenuChannel = CombineWith<ChannelSubject, 'context-menu'>

export type MainMenuChannel = CombineWith<MainMenuAction, 'main-menu'>
export type MainChannel = CombineWith<MainAction, 'main'>
export type ApiChannel = CombineWith<ApiAction, 'api'>

export type Channel =
  | ContextMenuChannel
  | MainMenuChannel
  | MainChannel
  | ApiChannel
export interface ContextMenuRequest {
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

export interface NotificationRequest {
  body: string
}

export interface MessageBoxRequest {
  message: string
  detail: string
  buttons: string[]
}

export interface DialogRequest {
  properties?: OpenDialogOptions['properties']
  filters?: OpenDialogOptions['filters']
}

export interface PrettierRequest {
  source: string
  parser: string
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
    invoke<T, U = any>(channel: Channel, payload: T): Promise<U>
    on(channel: Channel, cb: EventCallback): void
    once(channel: Channel, cb: EventCallback): void
  }
  store: {
    app: StoreProperties<AppStore>
    preferences: StoreProperties<PreferencesStore>
  }
  db: {
    migrate: (path: string) => Promise<void>
    migrateFromSnippetsLab: (path: string) => void
    move: (from: string, to: string) => Promise<void>
    isExist: (path: string) => boolean
  }
  track: (event: TrackEvents, payload?: string) => void
  platform: () => NodeJS.Platform
}
