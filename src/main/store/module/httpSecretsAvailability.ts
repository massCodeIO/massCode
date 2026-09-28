export interface SafeStorageAvailability {
  backend?: string
  encryptionAvailable: boolean
  platform: NodeJS.Platform
}

export function isSafeStorageUsable({
  backend,
  encryptionAvailable,
  platform,
}: SafeStorageAvailability): boolean {
  if (!encryptionAvailable) {
    return false
  }

  return (
    platform !== 'linux'
    || (backend !== undefined && backend !== 'basic_text' && backend !== 'unknown')
  )
}
