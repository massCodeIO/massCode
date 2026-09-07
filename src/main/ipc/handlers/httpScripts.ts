import type { WebContents } from 'electron'
import { scriptTrustSchema } from '../../../shared/httpScripts'
import { isTrustedApiRequest } from '../../api/requestIpc'
import { scriptsTrusted, setScriptTrust } from '../../http/scripts/trust'

export function registerHttpScriptHandlers(
  webContents: WebContents,
  rendererUrl: string,
) {
  webContents.ipc.handle(
    'spaces:http:script-trust-status',
    (event, payload: unknown) => {
      if (!isTrustedApiRequest(event, webContents, rendererUrl))
        throw new Error('Unauthorized IPC sender')
      const parsed = scriptTrustSchema.parse(payload)
      const subject = 'collectionId' in parsed ? 'collection' : 'request'
      const id
        = 'collectionId' in parsed ? parsed.collectionId : parsed.requestId
      return scriptsTrusted(id, parsed.scripts, subject)
    },
  )
  for (const [channel, allowed] of [
    ['spaces:http:script-trust', true],
    ['spaces:http:script-revoke', false],
  ] as const) {
    webContents.ipc.handle(channel, (event, payload: unknown) => {
      if (!isTrustedApiRequest(event, webContents, rendererUrl))
        throw new Error('Unauthorized IPC sender')
      const parsed = scriptTrustSchema.parse(payload)
      const subject = 'collectionId' in parsed ? 'collection' : 'request'
      const id
        = 'collectionId' in parsed ? parsed.collectionId : parsed.requestId
      setScriptTrust(id, parsed.scripts, allowed, subject)
      return allowed
    })
  }
}
