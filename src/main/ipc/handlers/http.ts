import type {
  HttpExecutePayload,
  HttpSecretPayload,
  HttpSecretSetPayload,
} from '../../types/http'
import { ipcMain } from 'electron'
import {
  deleteEnvironmentSecretHandler,
  setEnvironmentSecretHandler,
  unprotectEnvironmentSecretHandler,
} from '../../http/environmentSecrets'
import {
  cancelOwnedHttpExecution,
  executeOwnedHttpRequest,
} from '../../http/runtime/ownedExecution'
import { getHttpSession, resetHttpSession } from '../../http/runtime/session'
import {
  isSecretsEncryptionAvailable,
  revealEnvironmentSecret,
} from '../../http/secrets'
import { useHttpStorage } from '../../storage'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { registerHttpRunnerHandlers } from './httpRunner'
import { registerHttpWebSocketHandlers } from './httpWebSocket'

export {
  applyAuth,
  buildBody,
  formatHttpRequestError,
  interpolate,
  resolveEnvironment,
} from '../../http/runtime/execute'

export function registerHttpHandlers(): void {
  ipcMain.handle('spaces:http:history-snapshot', (_, id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0)
      return null
    return useHttpStorage().history.getSnapshot(id)
  })
  ipcMain.handle('spaces:http:cancel', event =>
    cancelOwnedHttpExecution(event.sender.id))
  registerHttpRunnerHandlers()
  registerHttpWebSocketHandlers()
  ipcMain.handle(
    'spaces:http:execute',
    async (event, payload: HttpExecutePayload) => {
      return executeOwnedHttpRequest(event.sender, payload)
    },
  )

  ipcMain.handle('spaces:http:clear-session', () => {
    resetHttpSession()
    return []
  })
  ipcMain.handle(
    'spaces:http:session-names',
    () =>
      getHttpSession(
        getVaultPath(),
        useHttpStorage().environments.getActiveEnvironmentId(),
      ).names,
  )

  ipcMain.handle('spaces:http:secrets-status', () => ({
    available: isSecretsEncryptionAvailable(),
  }))

  ipcMain.handle('spaces:http:set-secret', (_, payload: HttpSecretSetPayload) =>
    setEnvironmentSecretHandler(payload))

  ipcMain.handle('spaces:http:delete-secret', (_, payload: HttpSecretPayload) =>
    deleteEnvironmentSecretHandler(payload))

  ipcMain.handle(
    'spaces:http:unprotect-secret',
    (_, payload: HttpSecretPayload) =>
      unprotectEnvironmentSecretHandler(payload),
  )

  ipcMain.handle(
    'spaces:http:reveal-secret',
    (_, payload: HttpSecretPayload) => {
      const env = useHttpStorage()
        .environments
        .getEnvironments()
        .find(item => item.id === payload.environmentId)
      return env
        ? revealEnvironmentSecret(
            env.secretStorageId ?? String(env.id),
            payload.key.trim(),
          )
        : null
    },
  )
}
