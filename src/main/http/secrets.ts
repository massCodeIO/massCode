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

export function getEnvironmentSecrets(scopeId: string): Record<string, string> {
  return store.httpSecrets.getSecrets(getVaultPath(), scopeId)
}

export function getUsableSecretKeys(scopeId: string): string[] {
  return store.httpSecrets.getUsableKeys(getVaultPath(), scopeId)
}

export function revealEnvironmentSecret(
  scopeId: string,
  key: string,
): string | null {
  return store.httpSecrets.getSecret(getVaultPath(), scopeId, key)
}

export function setEnvironmentSecret(
  scopeId: string,
  key: string,
  value: string,
): void {
  store.httpSecrets.setSecret(getVaultPath(), scopeId, key, value)
}

export function deleteEnvironmentSecret(scopeId: string, key: string): void {
  store.httpSecrets.deleteSecret(getVaultPath(), scopeId, key)
}

export function deleteEnvironmentSecrets(scopeId: string): void {
  store.httpSecrets.deleteEnvironmentSecrets(getVaultPath(), scopeId)
}

export function moveSecretsToVault(
  fromVaultPath: string,
  toVaultPath: string,
): void {
  store.httpSecrets.moveVault(fromVaultPath, toVaultPath)
}

export function remapEnvironmentSecrets(fromId: number, toId: number): void {
  store.httpSecrets.renameEnvironment(
    getVaultPath(),
    String(fromId),
    String(toId),
  )
}
