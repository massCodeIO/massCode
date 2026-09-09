import type { WebContents } from 'electron'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import { isTrustedApiRequest } from '../../api/requestIpc'
import { httpConsole } from '../../http/devtools/console'
import i18n from '../../i18n'
import { mainWindowWebPreferences } from '../../windowSecurity'

export function registerHttpConsoleHandlers(
  owner: WebContents,
  rendererUrl: string,
  detached = false,
) {
  const unsubscribe = httpConsole.subscribe((event) => {
    if (!owner.isDestroyed())
      owner.send('spaces:http:console:event', event)
  })
  owner.once('destroyed', unsubscribe)
  let window: BrowserWindow | undefined
  for (const action of ['read', 'clear', 'detach'] as const) {
    owner.ipc.handle(`spaces:http:console:${action}`, (event) => {
      if (!isTrustedApiRequest(event, owner, rendererUrl))
        throw new Error('Unauthorized IPC sender')
      if (action === 'read')
        return httpConsole.read()
      if (action === 'clear')
        return httpConsole.clear()
      if (detached)
        return
      if (window && !window.isDestroyed()) {
        window.show()
        window.focus()
        return
      }
      window = new BrowserWindow({
        width: 1000,
        height: 650,
        title: i18n.t('spaces.http.devtools.console'),
        webPreferences: {
          ...mainWindowWebPreferences,
          preload: path.join(__dirname, '../../preload.js'),
        },
      })
      const url = new URL(rendererUrl)
      url.hash = '/http-console'
      registerHttpConsoleHandlers(window.webContents, rendererUrl, true)
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      window.webContents.on('will-navigate', event => event.preventDefault())
      void window.loadURL(url.toString())
    })
  }
  owner.once('destroyed', () => {
    if (window && !window.isDestroyed())
      window.destroy()
  })
}
