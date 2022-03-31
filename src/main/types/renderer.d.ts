import type {
  ContextMenuChannel,
  ContextMenuPayload,
  ElectronBridge,
  Channel
} from '.'

// TODO: почему то нет автокомплита для ContextMenuPayload
declare global {
  interface Window {
    electron: ElectronBridge
  }

  namespace Electron {
    interface IpcMain {
      handle<T, U>(
        channel: Channel,
        listener: (event: IpcMainInvokeEvent, payload: T) => Promise<U>
      ): void
    }
  }
}
