import { getVaultPath } from '../storage/providers/markdown/runtime/paths'
import { store } from '../store'

/**
 * Значения secret-переменных HTTP-окружений. В vault хранятся только имена
 * (`secretKeys` в .state.yaml), сами значения лежат локально и зашифрованы
 * через OS keychain, поэтому не уезжают в облачную папку вместе с vault.
 */
export function isSecretsEncryptionAvailable(): boolean {
  return store.httpSecrets.isEncryptionAvailable()
}

export function getEnvironmentSecrets(
  environmentId: number,
): Record<string, string> {
  return store.httpSecrets.getSecrets(getVaultPath(), environmentId)
}

export function getUsableSecretKeys(environmentId: number): string[] {
  return store.httpSecrets.getUsableKeys(getVaultPath(), environmentId)
}

export function revealEnvironmentSecret(
  environmentId: number,
  key: string,
): string | null {
  return store.httpSecrets.getSecret(getVaultPath(), environmentId, key)
}

export function setEnvironmentSecret(
  environmentId: number,
  key: string,
  value: string,
): void {
  store.httpSecrets.setSecret(getVaultPath(), environmentId, key, value)
}

export function deleteEnvironmentSecret(
  environmentId: number,
  key: string,
): void {
  store.httpSecrets.deleteSecret(getVaultPath(), environmentId, key)
}

export function deleteEnvironmentSecrets(environmentId: number): void {
  store.httpSecrets.deleteEnvironmentSecrets(getVaultPath(), environmentId)
}

export function moveSecretsToVault(
  fromVaultPath: string,
  toVaultPath: string,
): void {
  store.httpSecrets.moveVault(fromVaultPath, toVaultPath)
}

export function remapEnvironmentSecrets(fromId: number, toId: number): void {
  store.httpSecrets.renameEnvironment(getVaultPath(), fromId, toId)
}
