import type { IpcRendererEvent } from 'electron'
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
}

declare global {
  interface Window {
    electron: ElectronBridge
  }
}
