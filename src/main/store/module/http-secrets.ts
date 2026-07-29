import type { HttpSecretsStore } from '../types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { safeStorage } from 'electron'
import Store from 'electron-store'

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
  environmentId: number,
  secrets: Record<string, string> | null,
): void {
  const vaults = readVaults()
  const vaultKey = getVaultKey(vaultPath)
  const vault = { ...(vaults[vaultKey] ?? {}) }

  if (secrets && Object.keys(secrets).length > 0) {
    vault[String(environmentId)] = secrets
  }
  else {
    delete vault[String(environmentId)]
  }

  // Ключи пишутся целым объектом: имя переменной может содержать точку, а
  // electron-store трактует её как путь во вложенный объект.
  secretsStore.set('vaults', { ...vaults, [vaultKey]: vault })
}

function readEnvironmentSecrets(
  vaultPath: string,
  environmentId: number,
): Record<string, string> {
  const vault = readVaults()[getVaultKey(vaultPath)]
  const secrets = vault?.[String(environmentId)]

  return secrets && typeof secrets === 'object' ? secrets : {}
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
    return safeStorage.isEncryptionAvailable()
  },

  /**
   * Расшифрованные значения окружения для подстановки в запрос. Значения,
   * которые не удалось расшифровать, не попадают в результат.
   */
  getSecrets(vaultPath: string, environmentId: number): Record<string, string> {
    if (!safeStorage.isEncryptionAvailable()) {
      return {}
    }

    const result: Record<string, string> = {}
    for (const [key, encrypted] of Object.entries(
      readEnvironmentSecrets(vaultPath, environmentId),
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
  getUsableKeys(vaultPath: string, environmentId: number): string[] {
    if (!safeStorage.isEncryptionAvailable()) {
      return []
    }

    return Object.entries(readEnvironmentSecrets(vaultPath, environmentId))
      .filter(
        ([, encrypted]) =>
          typeof encrypted === 'string' && decrypt(encrypted) !== null,
      )
      .map(([key]) => key)
  },

  getSecret(
    vaultPath: string,
    environmentId: number,
    key: string,
  ): string | null {
    if (!safeStorage.isEncryptionAvailable()) {
      return null
    }

    const encrypted = readEnvironmentSecrets(vaultPath, environmentId)[key]
    return typeof encrypted === 'string' ? decrypt(encrypted) : null
  },

  setSecret(
    vaultPath: string,
    environmentId: number,
    key: string,
    value: string,
  ): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('ENCRYPTION_UNAVAILABLE: OS encryption is not available')
    }

    const secrets = { ...readEnvironmentSecrets(vaultPath, environmentId) }
    secrets[key] = safeStorage.encryptString(value).toString('base64')
    writeEnvironmentSecrets(vaultPath, environmentId, secrets)
  },

  deleteSecret(vaultPath: string, environmentId: number, key: string): void {
    const secrets = { ...readEnvironmentSecrets(vaultPath, environmentId) }
    if (!(key in secrets)) {
      return
    }

    delete secrets[key]
    writeEnvironmentSecrets(vaultPath, environmentId, secrets)
  },

  deleteEnvironmentSecrets(vaultPath: string, environmentId: number): void {
    writeEnvironmentSecrets(vaultPath, environmentId, null)
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
  renameEnvironment(vaultPath: string, fromId: number, toId: number): void {
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
