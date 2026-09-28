import type {
  HttpSecretMutationResult,
  HttpSecretPayload,
  HttpSecretSetPayload,
} from '../types/http'
import { useHttpStorage } from '../storage'
import { log } from '../utils'
import {
  deleteEnvironmentSecret,
  isSecretsEncryptionAvailable,
  revealEnvironmentSecret,
  setEnvironmentSecret,
} from './secrets'

/**
 * Значения секретов ходят только через IPC: локальный HTTP API слушает все
 * интерфейсы с открытым CORS, и отдавать через него расшифрованные секреты
 * означало бы обойти защиту OS keychain.
 */
export function setEnvironmentSecretHandler(
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

export function deleteEnvironmentSecretHandler(
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

export function unprotectEnvironmentSecretHandler(
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
