import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appGet = vi.fn()
const appSet = vi.fn()

vi.mock('../../store', () => ({
  store: {
    app: {
      get: (...args: unknown[]) => appGet(...args),
      set: (...args: unknown[]) => appSet(...args),
    },
  },
}))

const { activateLicense, validateStoredLicense, verifyLicenseKey }
  = await import('..')

// Подпись чужим ключом: валидна криптографически, но не нашим публичным ключом.
function makeForeignKey(payload: object) {
  const { privateKey } = generateKeyPairSync('ed25519')
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  )
  const signature = sign(null, Buffer.from(payloadBase64), privateKey).toString(
    'base64url',
  )

  return `${payloadBase64}.${signature}`
}

// Выпущена скриптом scripts/license/issue.js парным приватным ключом.
const VALID_KEY
  = 'eyJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaXNzdWVkQXQiOiIyMDI2LTA2LTEyIn0.C7HJmtCZI6KRGSFF1WmwAVDys2t_dP-jWBDXLGOiqjI6tQCMIqZIUFfZm5kOwR1lf1KHtzfv3NnB5sFV6H5TCQ'

describe('verifyLicenseKey', () => {
  it('accepts a key signed with the project private key', () => {
    expect(verifyLicenseKey(VALID_KEY)).toEqual({
      name: 'Test User',
      email: 'test@example.com',
      issuedAt: '2026-06-12',
    })
  })

  it('accepts a key with surrounding whitespace', () => {
    expect(verifyLicenseKey(`  ${VALID_KEY}\n`)).not.toBeNull()
  })

  it('rejects a key signed with a foreign private key', () => {
    expect(verifyLicenseKey(makeForeignKey({ name: 'Mallory' }))).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const [, signature] = VALID_KEY.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ name: 'Mallory' }),
    ).toString('base64url')

    expect(verifyLicenseKey(`${tamperedPayload}.${signature}`)).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(verifyLicenseKey('')).toBeNull()
    expect(verifyLicenseKey('not-a-key')).toBeNull()
    expect(verifyLicenseKey('a.b.c')).toBeNull()
  })
})

describe('activateLicense', () => {
  beforeEach(() => {
    appSet.mockClear()
  })

  it('stores a valid key with the supporter name', () => {
    expect(activateLicense(VALID_KEY)).toEqual({
      active: true,
      name: 'Test User',
    })
    expect(appSet).toHaveBeenCalledWith('license', {
      key: VALID_KEY,
      name: 'Test User',
    })
  })

  it('does not store an invalid key', () => {
    expect(activateLicense('garbage')).toEqual({ active: false, name: null })
    expect(appSet).not.toHaveBeenCalled()
  })
})

describe('validateStoredLicense', () => {
  beforeEach(() => {
    appGet.mockReset()
    appSet.mockClear()
  })

  it('keeps a valid stored key', () => {
    appGet.mockReturnValue(VALID_KEY)
    validateStoredLicense()
    expect(appSet).not.toHaveBeenCalled()
  })

  it('resets an invalid stored key', () => {
    appGet.mockReturnValue('tampered')
    validateStoredLicense()
    expect(appSet).toHaveBeenCalledWith('license', { key: null, name: null })
  })

  it('does nothing when no key is stored', () => {
    appGet.mockReturnValue(null)
    validateStoredLicense()
    expect(appSet).not.toHaveBeenCalled()
  })
})
