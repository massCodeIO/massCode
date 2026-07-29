import type { HttpSecretsStore } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { safeStorage } from 'electron'
import Store from 'electron-store'
import { isSafeStorageUsable } from './httpSecretsAvailability'

const secretsStore = new Store<HttpSecretsStore>({
  name: 'http-secrets',
  cwd: 'v2',

  defaults: {
    vaults: {},
  },
})

/**
 * Секреты привязаны к конкретному vault: путь к хранилищу настраивается, и
 * без такой привязки окружение с тем же id из другого vault подхватило бы
 * чужие значения.
 */
function getVaultKey(vaultPath: string): string {
  return createHash('sha256')
    .update(path.resolve(vaultPath))
    .digest('hex')
    .slice(0, 16)
}

function readVaults(): HttpSecretsStore['vaults'] {
  const vaults = secretsStore.get('vaults')
  return vaults && typeof vaults === 'object' ? vaults : {}
}

function writeEnvironmentSecrets(
  vaultPath: string,
  scopeId: string,
  secrets: Record<string, string> | null,
): void {
  const vaults = readVaults()
  const vaultKey = getVaultKey(vaultPath)
  const vault = { ...(vaults[vaultKey] ?? {}) }

  if (secrets && Object.keys(secrets).length > 0) {
    vault[scopeId] = secrets
  }
  else {
    delete vault[scopeId]
  }

  // Ключи пишутся целым объектом: имя переменной может содержать точку, а
  // electron-store трактует её как путь во вложенный объект.
  secretsStore.set('vaults', { ...vaults, [vaultKey]: vault })
}

function readEnvironmentSecrets(
  vaultPath: string,
  scopeId: string,
): Record<string, string> {
  const vault = readVaults()[getVaultKey(vaultPath)]
  const secrets = vault?.[scopeId]

  return secrets && typeof secrets === 'object' ? secrets : {}
}

function isEncryptionUsable(): boolean {
  try {
    let backend: string | undefined
    if (process.platform === 'linux') {
      backend = safeStorage.getSelectedStorageBackend()
    }

    return isSafeStorageUsable({
      backend,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      platform: process.platform,
    })
  }
  catch {
    return false
  }
}

function decrypt(encrypted: string): string | null {
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }
  catch {
    // Значение зашифровано другим OS-пользователем или ключ keychain сменился.
    return null
  }
}

export default {
  isEncryptionAvailable(): boolean {
    return isEncryptionUsable()
  },

  /**
   * Расшифрованные значения окружения для подстановки в запрос. Значения,
   * которые не удалось расшифровать, не попадают в результат.
   */
  getSecrets(vaultPath: string, scopeId: string): Record<string, string> {
    if (!isEncryptionUsable()) {
      return {}
    }

    const result: Record<string, string> = {}
    for (const [key, encrypted] of Object.entries(
      readEnvironmentSecrets(vaultPath, scopeId),
    )) {
      const value = typeof encrypted === 'string' ? decrypt(encrypted) : null
      if (value !== null) {
        result[key] = value
      }
    }
    return result
  },

  /**
   * Имена секретов, значения которых реально доступны на этом устройстве.
   * Запись, которую не удаётся расшифровать (сменился keychain, другой
   * OS-пользователь), не считается заданной: иначе UI показывал бы секрет
   * заполненным, а запрос уходил бы с пустым значением.
   */
  getUsableKeys(vaultPath: string, scopeId: string): string[] {
    if (!isEncryptionUsable()) {
      return []
    }

    return Object.entries(readEnvironmentSecrets(vaultPath, scopeId))
      .filter(
        ([, encrypted]) =>
          typeof encrypted === 'string' && decrypt(encrypted) !== null,
      )
      .map(([key]) => key)
  },

  getSecret(vaultPath: string, scopeId: string, key: string): string | null {
    if (!isEncryptionUsable()) {
      return null
    }

    const encrypted = readEnvironmentSecrets(vaultPath, scopeId)[key]
    return typeof encrypted === 'string' ? decrypt(encrypted) : null
  },

  setSecret(
    vaultPath: string,
    scopeId: string,
    key: string,
    value: string,
  ): void {
    if (!isEncryptionUsable()) {
      throw new Error('ENCRYPTION_UNAVAILABLE: OS encryption is not available')
    }

    const secrets = { ...readEnvironmentSecrets(vaultPath, scopeId) }
    secrets[key] = safeStorage.encryptString(value).toString('base64')
    writeEnvironmentSecrets(vaultPath, scopeId, secrets)
  },

  deleteSecret(vaultPath: string, scopeId: string, key: string): void {
    const secrets = { ...readEnvironmentSecrets(vaultPath, scopeId) }
    if (!(key in secrets)) {
      return
    }

    delete secrets[key]
    writeEnvironmentSecrets(vaultPath, scopeId, secrets)
  },

  deleteEnvironmentSecrets(vaultPath: string, scopeId: string): void {
    writeEnvironmentSecrets(vaultPath, scopeId, null)
  },

  /**
   * Секреты привязаны к пути vault, поэтому при его переносе значения нужно
   * перепривязать, иначе они молча станут «не заданы на этом устройстве».
   */
  moveVault(fromVaultPath: string, toVaultPath: string): void {
    const vaults = readVaults()
    const fromKey = getVaultKey(fromVaultPath)
    const toKey = getVaultKey(toVaultPath)
    const source = vaults[fromKey]

    if (fromKey === toKey || !source) {
      return
    }

    const next = {
      ...vaults,
      [toKey]: { ...(vaults[toKey] ?? {}), ...source },
    }
    delete next[fromKey]
    secretsStore.set('vaults', next)
  },

  /** Перепривязка значений, когда окружение получило новый id. */
  renameEnvironment(vaultPath: string, fromId: string, toId: string): void {
    if (fromId === toId) {
      return
    }

    const secrets = readEnvironmentSecrets(vaultPath, fromId)
    if (Object.keys(secrets).length === 0) {
      return
    }

    writeEnvironmentSecrets(vaultPath, fromId, null)
    writeEnvironmentSecrets(vaultPath, toId, secrets)
  },
}
