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
      const { requestId, scripts } = scriptTrustSchema.parse(payload)
      return scriptsTrusted(requestId, scripts)
    },
  )
  for (const [channel, allowed] of [
    ['spaces:http:script-trust', true],
    ['spaces:http:script-revoke', false],
  ] as const) {
    webContents.ipc.handle(channel, (event, payload: unknown) => {
      if (!isTrustedApiRequest(event, webContents, rendererUrl))
        throw new Error('Unauthorized IPC sender')
      const { requestId, scripts } = scriptTrustSchema.parse(payload)
      setScriptTrust(requestId, scripts, allowed)
      return allowed
    })
  }
}
