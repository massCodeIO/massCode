import type { ElectronBridge, Channel } from '.'

declare global {
  interface Window {
    electron: ElectronBridge
  }

  namespace Electron {
    interface IpcMain {
      handle<T, U = void>(
        channel: Channel,
        listener: (event: IpcMainInvokeEvent, payload: T) => Promise<U>
      ): void
    }
  }
}
