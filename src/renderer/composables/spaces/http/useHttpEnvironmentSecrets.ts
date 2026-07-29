import type {
  HttpSecretMutationError,
  HttpSecretMutationResult,
} from '~/main/types/http'
import { useSonner } from '@/composables/useSonner'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n, ipc } from '@/electron'

/**
 * Значения secret-переменных ходят только через IPC: локальный HTTP API
 * доступен из сети и браузера, поэтому расшифрованные секреты через него
 * не отдаются.
 */
const isSecretsEncryptionAvailable = ref(true)

function notifySecretError(error: HttpSecretMutationError | 'reveal'): void {
  const messages: Record<typeof error, string> = {
    invalidKey: i18n.t('messages:error.secretNameRequired'),
    notFound: i18n.t('messages:error.secretEnvironmentMissing'),
    reveal: i18n.t('messages:error.secretRevealFailed'),
    unavailable: i18n.t('messages:error.secretEncryptionUnavailable'),
    unknown: i18n.t('messages:error.secretSaveFailed'),
  }

  useSonner().sonner({ message: messages[error], type: 'error' })
}

async function refreshSecretsStatus() {
  try {
    const { available } = (await ipc.invoke(
      'spaces:http:secrets-status',
      null,
    )) as { available: boolean }
    isSecretsEncryptionAvailable.value = available
  }
  catch (error) {
    console.error(error)
  }
}

async function setSecret(environmentId: number, key: string, value: string) {
  try {
    markPersistedStorageMutation()
    const result = (await ipc.invoke('spaces:http:set-secret', {
      environmentId,
      key,
      value,
    })) as HttpSecretMutationResult

    if (!result.ok) {
      notifySecretError(result.error ?? 'unknown')
    }

    return result.ok
  }
  catch (error) {
    console.error(error)
    notifySecretError('unknown')
    return false
  }
}

async function deleteSecret(environmentId: number, key: string) {
  try {
    markPersistedStorageMutation()
    const result = (await ipc.invoke('spaces:http:delete-secret', {
      environmentId,
      key,
    })) as HttpSecretMutationResult

    if (!result.ok) {
      notifySecretError(result.error ?? 'unknown')
    }

    return result.ok
  }
  catch (error) {
    console.error(error)
    notifySecretError('unknown')
    return false
  }
}

async function revealSecret(environmentId: number, key: string) {
  try {
    const value = (await ipc.invoke('spaces:http:reveal-secret', {
      environmentId,
      key,
    })) as string | null

    if (value === null) {
      notifySecretError('reveal')
    }

    return value
  }
  catch (error) {
    console.error(error)
    notifySecretError('reveal')
    return null
  }
}

async function unprotectSecret(environmentId: number, key: string) {
  try {
    markPersistedStorageMutation()
    const result = (await ipc.invoke('spaces:http:unprotect-secret', {
      environmentId,
      key,
    })) as HttpSecretMutationResult

    if (!result.ok) {
      notifySecretError(result.error ?? 'unknown')
    }
    return result.ok
  }
  catch (error) {
    console.error(error)
    notifySecretError('unknown')
    return false
  }
}

export function useHttpEnvironmentSecrets() {
  return {
    deleteSecret,
    isSecretsEncryptionAvailable,
    refreshSecretsStatus,
    revealSecret,
    setSecret,
    unprotectSecret,
  }
}
