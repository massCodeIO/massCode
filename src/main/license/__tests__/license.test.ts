import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateLicense, validateStoredLicense, verifyLicenseKey } from '..'

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

// Выпущены скриптом scripts/license/issue.js парным приватным ключом.
const VALID_KEY
  = 'eyJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaXNzdWVkQXQiOiIyMDI2LTA2LTEyIn0.C7HJmtCZI6KRGSFF1WmwAVDys2t_dP-jWBDXLGOiqjI6tQCMIqZIUFfZm5kOwR1lf1KHtzfv3NnB5sFV6H5TCQ'
const EMAIL_ONLY_KEY
  = 'eyJlbWFpbCI6Im9ubHlAZXhhbXBsZS5jb20iLCJpc3N1ZWRBdCI6IjIwMjYtMDYtMTIifQ.xtJVJrjHSIgaTaD47cKV_kmUbxvdGcEZNklOe1phE670m52XkBjTSba8IglWdpW1TL87UwoUQg2cw2QBR0aiDQ'
// Подписан нашим ключом, но в payload нет обязательного email.
const NAME_ONLY_KEY
  = 'eyJuYW1lIjoiTm8gRW1haWwiLCJpc3N1ZWRBdCI6IjIwMjYtMDYtMTIifQ.h3nngjQxRxc5RzhvrzBCbCoBDrTCKwbyiNf4fkoIjIBlf4hXhu3I3L5yb8MVwSMmAaInscj-lZk99sQGwFuKDA'

describe('verifyLicenseKey', () => {
  it('accepts a key signed with the project private key', () => {
    expect(verifyLicenseKey(VALID_KEY)).toEqual({
      name: 'Test User',
      email: 'test@example.com',
      issuedAt: '2026-06-12',
    })
  })

  it('accepts a key without a name', () => {
    expect(verifyLicenseKey(EMAIL_ONLY_KEY)).toEqual({
      email: 'only@example.com',
      issuedAt: '2026-06-12',
    })
  })

  it('rejects a signed key without an email', () => {
    expect(verifyLicenseKey(NAME_ONLY_KEY)).toBeNull()
  })

  it('accepts a key with surrounding whitespace', () => {
    expect(verifyLicenseKey(`  ${VALID_KEY}\n`)).not.toBeNull()
  })

  it('rejects a key signed with a foreign private key', () => {
    expect(
      verifyLicenseKey(makeForeignKey({ email: 'mallory@example.com' })),
    ).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const [, signature] = VALID_KEY.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: 'mallory@example.com' }),
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

  it('stores a valid key with the supporter identity', () => {
    expect(activateLicense(VALID_KEY)).toEqual({
      active: true,
      name: 'Test User',
      email: 'test@example.com',
    })
    expect(appSet).toHaveBeenCalledWith('license', {
      key: VALID_KEY,
      name: 'Test User',
      email: 'test@example.com',
    })
  })

  it('stores a key without a name', () => {
    expect(activateLicense(EMAIL_ONLY_KEY)).toEqual({
      active: true,
      name: null,
      email: 'only@example.com',
    })
  })

  it('does not store an invalid key', () => {
    expect(activateLicense('garbage')).toEqual({
      active: false,
      name: null,
      email: null,
    })
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
    expect(appSet).toHaveBeenCalledWith('license', {
      key: null,
      name: null,
      email: null,
    })
  })

  it('does nothing when no key is stored', () => {
    appGet.mockReturnValue(null)
    validateStoredLicense()
    expect(appSet).not.toHaveBeenCalled()
  })
})
