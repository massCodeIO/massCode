import type { IpcRendererEvent, OpenDialogOptions } from 'electron'
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
  | 'collapse-all'
  | 'expand-all'
  | 'restore-from-trash'
  | 'copy-snippet-link'
  | 'set-custom-icon'
  | 'none'

export type ContextMenuType =
  | 'folder'
  | 'inbox'
  | 'all'
  | 'trash'
  | 'favorites'
  | 'tag'

type MainMenuAction =
  | 'add-description'
  | 'copy-snippet'
  | 'format-snippet'
  | 'new-folder'
  | 'new-fragment'
  | 'new-snippet'
  | 'preferences'
  | 'presentation-mode'
  | 'preview-code'
  | 'preview-markdown'
  | 'preview-mindmap'
  | 'search'
  | 'sort-snippets'
  | 'hide-subfolder-snippets'
  | 'compact-mode-snippets'
  | 'font-size-increase'
  | 'font-size-decrease'
  | 'font-size-reset'
  | 'history-back'
  | 'history-forward'
  | 'devtools'

type MainAction =
  | 'restart'
  | 'restart-api'
  | 'notification'
  | 'open-dialog'
  | 'open-message-box'
  | 'update-available'
  | 'open-url'
  | 'prettier'
  | 'focus'
  | 'copy-to-assets'
  | 'app-protocol'

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
    create: () => void
    migrate: (path: string) => Promise<void>
    migrateFromSnippetsLab: (path: string) => void
    move: (from: string, to: string) => Promise<void>
    isExist: (path: string) => boolean
  }
  i18n: {
    t: (key: string, options?: any) => string
  }
  platform: () => NodeJS.Platform
  version: string
}
