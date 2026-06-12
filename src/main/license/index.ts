import { Buffer } from 'node:buffer'
import { createPublicKey, verify } from 'node:crypto'
import { store } from '../store'

// Публичный ключ Ed25519 (SPKI DER, base64). Парный приватный ключ хранится
// только у мейнтейнера и используется скриптом scripts/license/issue.js.
const LICENSE_PUBLIC_KEY
  = 'MCowBQYDK2VwAyEA50TFZklSS8Q64UeasAngOrgKnQe2COfVkqiuS9YPIdo='

const publicKey = createPublicKey({
  key: Buffer.from(LICENSE_PUBLIC_KEY, 'base64'),
  format: 'der',
  type: 'spki',
})

export interface LicensePayload {
  name: string
  email?: string
  issuedAt?: string
}

export interface LicenseStatus {
  active: boolean
  name: string | null
}

export function verifyLicenseKey(key: string): LicensePayload | null {
  try {
    const [payloadBase64, signatureBase64] = key.trim().split('.')

    if (!payloadBase64 || !signatureBase64) {
      return null
    }

    const isValid = verify(
      null,
      Buffer.from(payloadBase64),
      publicKey,
      Buffer.from(signatureBase64, 'base64url'),
    )

    if (!isValid) {
      return null
    }

    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8'),
    )

    if (typeof payload?.name !== 'string') {
      return null
    }

    return payload as LicensePayload
  }
  catch {
    return null
  }
}

export function activateLicense(key: string): LicenseStatus {
  const payload = verifyLicenseKey(key)

  if (!payload) {
    return { active: false, name: null }
  }

  store.app.set('license', { key: key.trim(), name: payload.name })

  return { active: true, name: payload.name }
}

// Страховка от ручной правки store-файла: невалидный ключ сбрасывается.
export function validateStoredLicense() {
  const key = store.app.get('license.key')

  if (typeof key === 'string' && key && !verifyLicenseKey(key)) {
    store.app.set('license', { key: null, name: null })
  }
}
