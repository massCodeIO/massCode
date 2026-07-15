interface VaultDoctorWarningLike {
  code: string
  details?: object
}

interface VaultDoctorWarningKeyInput extends VaultDoctorWarningLike {
  path: string
  space: string
}

interface FormattedVaultDoctorWarning {
  message: string
  recommendation: string | null
}

type Translate = (key: string, options?: Record<string, string>) => string

const NOTES_ASSET_WARNING_CODES = new Set([
  'NOTES_LEGACY_ASSET',
  'NOTES_ASSET_MIGRATION_PENDING',
  'NOTES_ASSET_DESTINATION_CONFLICT',
  'NOTES_ASSET_MISSING',
])

function getAssetName(details?: object): string {
  const value = (details as { assetName?: unknown } | undefined)?.assetName
  return typeof value === 'string' ? value : ''
}

export function getVaultDoctorWarningKey(
  warning: VaultDoctorWarningKeyInput,
): string {
  return [
    warning.space,
    warning.path,
    warning.code,
    getAssetName(warning.details),
  ].join(':')
}

export function formatVaultDoctorWarning(
  warning: VaultDoctorWarningLike,
  translate: Translate,
): FormattedVaultDoctorWarning {
  if (!NOTES_ASSET_WARNING_CODES.has(warning.code)) {
    return { message: warning.code, recommendation: null }
  }

  const key = `preferences:storage.vaultDoctor.assetWarnings.${warning.code}`
  const options = { assetName: getAssetName(warning.details) }

  return {
    message: translate(`${key}.message`, options),
    recommendation: translate(`${key}.recommendation`, options),
  }
}
