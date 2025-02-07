import type { IpcRendererEvent } from 'electron'

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
        on: (channel: string, cb: EventCallback) => void
        send: (channel: string, data: any, cb: EventCallback) => void
        removeListener: (channel: string, cb: EventCallback) => void
        removeListeners: (channel: string) => void
      }
      db: {
        query: (sql: string, params?: any[]) => Promise<any>
      }
    }
  }
}
