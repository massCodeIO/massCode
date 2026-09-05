import { ipcMain } from 'electron'
import {
  wsConnectSchema,
  wsIdSchema,
  wsReadSchema,
  wsSendSchema,
} from '../../../shared/httpWebSocket'
import {
  clearWebSocket,
  connectWebSocket,
  disconnectWebSocket,
  disposeWebSocket,
  readWebSocket,
  sendWebSocket,
} from '../../http/websocket/session'

const owners = new WeakSet<Electron.WebContents>()

export function registerHttpWebSocketHandlers() {
  ipcMain.handle('spaces:http:ws-connect', (event, payload: unknown) => {
    const parsed = wsConnectSchema.safeParse(payload)
    if (!parsed.success)
      throw new Error('WS_INVALID')
    const sender = event.sender
    const owner = sender.id
    if (!owners.has(sender)) {
      owners.add(sender)
      sender.once('destroyed', () => disposeWebSocket(owner))
      sender.on(
        'did-start-navigation',
        (_event, _url, isInPlace, isMainFrame) => {
          if (isMainFrame && !isInPlace)
            disposeWebSocket(owner)
        },
      )
    }
    return connectWebSocket(owner, parsed.data)
  })
  ipcMain.handle('spaces:http:ws-read', (event, payload: unknown) => {
    const parsed = wsReadSchema.safeParse(payload)
    if (!parsed.success)
      throw new Error('WS_INVALID')
    return readWebSocket(
      event.sender.id,
      parsed.data.connectionId,
      parsed.data.after,
    )
  })
  ipcMain.handle('spaces:http:ws-send', (event, payload: unknown) => {
    const parsed = wsSendSchema.safeParse(payload)
    if (!parsed.success)
      throw new Error('WS_INVALID')
    return sendWebSocket(
      event.sender.id,
      parsed.data.connectionId,
      parsed.data.text,
    )
  })
  for (const [channel, action] of [
    ['spaces:http:ws-disconnect', disconnectWebSocket],
    ['spaces:http:ws-clear', clearWebSocket],
    ['spaces:http:ws-dispose', disposeWebSocket],
  ] as const) {
    ipcMain.handle(channel, (event, payload: unknown) => {
      const parsed = wsIdSchema.safeParse(payload)
      if (!parsed.success)
        throw new Error('WS_INVALID')
      return action(event.sender.id, parsed.data.connectionId)
    })
  }
}
