import type { IpcRendererEvent } from 'electron'

declare interface EventCallback {
  (event?: IpcRendererEvent, ...args: any[]): void
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
    }
  }
}
