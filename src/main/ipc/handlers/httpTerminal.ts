import type { WebContents } from 'electron'
import {
  terminalCreateSchema,
  terminalIdSchema,
  terminalInputSchema,
  terminalResizeSchema,
} from '../../../shared/httpDevtools'
import { isTrustedApiRequest } from '../../api/requestIpc'
import { HttpTerminalManager } from '../../http/devtools/terminal'

export function registerHttpTerminalHandlers(
  owner: WebContents,
  rendererUrl: string,
) {
  const manager = new HttpTerminalManager((event) => {
    if (!owner.isDestroyed())
      owner.send('spaces:http:terminal:event', event)
  })
  const actions = {
    list: () => manager.list(),
    create: (payload: unknown) => {
      const { cols, rows } = terminalCreateSchema.parse(payload)
      return manager.create(cols, rows)
    },
    input: (payload: unknown) => {
      const { id, data } = terminalInputSchema.parse(payload)
      manager.input(id, data)
    },
    resize: (payload: unknown) => {
      const { id, cols, rows } = terminalResizeSchema.parse(payload)
      manager.resize(id, cols, rows)
    },
    clear: (payload: unknown) =>
      manager.clear(terminalIdSchema.parse(payload).id),
    kill: (payload: unknown) =>
      manager.kill(terminalIdSchema.parse(payload).id),
  }
  for (const [action, handler] of Object.entries(actions)) {
    owner.ipc.handle(
      `spaces:http:terminal:${action}`,
      (event, payload: unknown) => {
        if (!isTrustedApiRequest(event, owner, rendererUrl))
          throw new Error('Unauthorized IPC sender')
        return handler(payload)
      },
    )
  }
  owner.once('destroyed', () => manager.dispose())
  // A reload reconnects to existing sessions. Navigation away from our renderer
  // terminates processes instead of letting untrusted content inherit them.
  owner.on('will-navigate', (_event, url) => {
    const current = new URL(rendererUrl)
    const next = new URL(url)
    current.hash = ''
    current.search = ''
    next.hash = ''
    next.search = ''
    if (current.toString() !== next.toString())
      manager.dispose()
  })
}
