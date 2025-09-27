import type { IpcRendererEvent } from 'electron'
import type { Store } from '../store/types'
import type { Channel } from './ipc'

export interface EventCallback {
  (event?: IpcRendererEvent, ...args: any[]): void
}

export interface DBQueryArgs {
  sql: string
  params?: unknown[]
}

declare global {
  interface Window {
    electron: {
      ipc: {
        on: (channel: Channel, cb: EventCallback) => void
        send: (channel: Channel, data: any, cb: EventCallback) => void
        invoke: <T, U = any>(channel: Channel, data: T) => Promise<U>
        removeListener: (channel: Channel, cb: EventCallback) => void
        removeListeners: (channel: Channel) => void
      }
      db: {
        query: (sql: string, params?: any[]) => Promise<any>
      }
      store: Store
      i18n: {
        t: (key: string, options?: any) => string
      }
    }
  }

  // eslint-disable-next-line ts/no-namespace
  namespace Electron {
    interface IpcMain {
      // eslint-disable-next-line ts/method-signature-style
      handle<T, U = any>(
        channel: Channel,
        listener: (event: IpcMainInvokeEvent, payload: T) => Promise<U>,
      ): void
    }
  }
}
