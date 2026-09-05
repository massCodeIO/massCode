import type {
  HttpExecutePayload,
  HttpSecretMutationResult,
  HttpSecretPayload,
  HttpSecretSetPayload,
} from '../../types/http'
import { ipcMain } from 'electron'
import { executeHttpRequest } from '../../http/runtime/execute'
import {
  beginHttpExecution,
  finishHttpExecution,
  getHttpSession,
  resetHttpSession,
} from '../../http/runtime/session'
import {
  deleteEnvironmentSecret,
  isSecretsEncryptionAvailable,
  revealEnvironmentSecret,
  setEnvironmentSecret,
} from '../../http/secrets'
import { useHttpStorage } from '../../storage'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { log } from '../../utils'
import { registerHttpRunnerHandlers } from './httpRunner'

export {
  applyAuth,
  buildBody,
  formatHttpRequestError,
  interpolate,
  resolveEnvironment,
} from '../../http/runtime/execute'

/**
 * Значения секретов ходят только через IPC: локальный HTTP API слушает все
 * интерфейсы с открытым CORS, и отдавать через него расшифрованные секреты
 * означало бы обойти защиту OS keychain.
 */
function setEnvironmentSecretHandler(
  payload: HttpSecretSetPayload,
): HttpSecretMutationResult {
  const key = payload.key.trim()
  if (!key) {
    return { error: 'invalidKey', ok: false }
  }

  if (!isSecretsEncryptionAvailable()) {
    return { error: 'unavailable', ok: false }
  }

  const storage = useHttpStorage()
  const env = storage.environments
    .getEnvironments()
    .find(item => item.id === payload.environmentId)
  if (!env) {
    return { error: 'notFound', ok: false }
  }
  const scopeId = env.secretStorageId ?? String(env.id)
  const wasProtected = (env.secretKeys ?? []).includes(key)
  const previousValue = revealEnvironmentSecret(scopeId, key)
  try {
    // Сначала сохраняем зашифрованное значение локально и только потом удаляем
    // plain-значение из vault (`addSecretKey` делает и то, и другое). Обратный
    // порядок терял бы значение полностью при сбое шифрования.
    setEnvironmentSecret(scopeId, key, payload.value)

    // Обновление уже защищённого значения не меняет vault metadata и поэтому
    // не зависит от доступности синхронизируемого state-файла.
    if (wasProtected) {
      return { ok: true }
    }

    const { notFound } = storage.environments.addSecretKey(
      payload.environmentId,
      key,
    )
    if (notFound) {
      // Окружение исчезло между вызовами: локальный секрет теперь ничей.
      if (previousValue === null) {
        deleteEnvironmentSecret(scopeId, key)
      }
      else {
        setEnvironmentSecret(scopeId, key, previousValue)
      }
      return { error: 'notFound', ok: false }
    }

    return { ok: true }
  }
  catch {
    // `addSecretKey` мог упасть (например vault в состоянии гидрации) уже после
    // успешного шифрования: без компенсации локальное значение осталось бы без
    // ключа в `secretKeys` — невидимым и неудаляемым. Удаление безопасно, это
    // значение записал сам этот вызов.
    if (previousValue === null) {
      deleteEnvironmentSecret(scopeId, key)
    }
    else {
      setEnvironmentSecret(scopeId, key, previousValue)
    }
    return { error: 'unknown', ok: false }
  }
}

function deleteEnvironmentSecretHandler(
  payload: HttpSecretPayload,
): HttpSecretMutationResult {
  const key = payload.key.trim()
  const storage = useHttpStorage()
  const env = storage.environments
    .getEnvironments()
    .find(item => item.id === payload.environmentId)
  if (!env) {
    return { error: 'notFound', ok: false }
  }
  const scopeId = env.secretStorageId ?? String(env.id)

  try {
    const { notFound } = storage.environments.removeSecretKey(
      payload.environmentId,
      key,
    )
    if (notFound) {
      return { error: 'notFound', ok: false }
    }
  }
  catch {
    return { error: 'unknown', ok: false }
  }

  try {
    deleteEnvironmentSecret(scopeId, key)
  }
  catch (error) {
    log('http:delete-secret-cleanup', error)
  }
  return { ok: true }
}

function unprotectEnvironmentSecretHandler(
  payload: HttpSecretPayload,
): HttpSecretMutationResult {
  const key = payload.key.trim()
  const storage = useHttpStorage()
  const env = storage.environments
    .getEnvironments()
    .find(item => item.id === payload.environmentId)
  if (!env) {
    return { error: 'notFound', ok: false }
  }

  const scopeId = env.secretStorageId ?? String(env.id)
  const value = revealEnvironmentSecret(scopeId, key)
  if (value === null) {
    return { error: 'unknown', ok: false }
  }

  try {
    const { notFound } = storage.environments.unprotectSecret(
      payload.environmentId,
      key,
      value,
    )
    if (notFound) {
      return { error: 'notFound', ok: false }
    }
  }
  catch {
    return { error: 'unknown', ok: false }
  }

  try {
    deleteEnvironmentSecret(scopeId, key)
  }
  catch (error) {
    log('http:unprotect-secret-cleanup', error)
  }
  return { ok: true }
}

export function registerHttpHandlers(): void {
  registerHttpRunnerHandlers()
  ipcMain.handle(
    'spaces:http:execute',
    async (_, payload: HttpExecutePayload) => {
      if (!beginHttpExecution())
        throw new Error('HTTP_REQUEST_RUNNING')
      try {
        return await executeHttpRequest(payload)
      }
      finally {
        finishHttpExecution()
      }
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
