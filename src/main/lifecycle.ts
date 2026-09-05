import type { BrowserWindow, IpcMainEvent } from 'electron'
import { app, ipcMain } from 'electron'
import { setQuitting } from './quitState'

let getWindow: () => BrowserWindow | undefined = () => undefined
let prepareQuit: () => boolean = () => true
let pending: Promise<boolean> | null = null
let requestId = 0

export function configureLifecycle(
  window: () => BrowserWindow | undefined,
  cleanup: () => boolean,
) {
  getWindow = window
  prepareQuit = cleanup
}

function confirmRendererLeave(): Promise<boolean> {
  const window = getWindow()
  if (!window || window.isDestroyed())
    return Promise.resolve(true)
  const contents = window.webContents
  if (contents.isDestroyed())
    return Promise.resolve(false)

  // Показываем диалог даже при Quit из Dock у скрытого macOS-окна.
  window.show()
  const id = ++requestId
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    function finish(allowed: boolean) {
      clearTimeout(timer)
      ipcMain.removeListener('system:confirm-leave-result', onResult)
      resolve(allowed)
    }
    function onResult(event: IpcMainEvent, payload: unknown) {
      if (event.sender !== contents || event.senderFrame !== contents.mainFrame)
        return
      if (
        !payload
        || typeof payload !== 'object'
        || !('id' in payload)
        || payload.id !== id
      ) {
        return
      }
      finish('allowed' in payload && payload.allowed === true)
    }
    // Не закрываем приложение без ответа (crash/hang/незавершённый startup).
    timer = setTimeout(() => finish(false), 60_000)
    ipcMain.on('system:confirm-leave-result', onResult)
    try {
      contents.send('system:confirm-leave', { id })
    }
    catch {
      finish(false)
    }
  })
}

export function requestLifecycleAction(
  action: () => void = () => app.quit(),
  quit = true,
): Promise<boolean> {
  // Первый intent выигрывает: повторные Quit/Restart не выполняют два выхода.
  if (pending)
    return pending
  pending = (async () => {
    try {
      if (!(await confirmRendererLeave()))
        return false
      if (quit && !prepareQuit())
        return false
      if (quit)
        setQuitting(true)
      action()
      return true
    }
    catch {
      setQuitting(false)
      return false
    }
    finally {
      pending = null
    }
  })()
  return pending
}
