import { describe, expect, it } from 'vitest'
import { isSafeStorageUsable } from '../httpSecretsAvailability'

describe('isSafeStorageUsable', () => {
  it.each(['basic_text', 'unknown', undefined])(
    'fails closed on Linux for backend %s',
    (backend) => {
      expect(
        isSafeStorageUsable({
          backend,
          encryptionAvailable: true,
          platform: 'linux',
        }),
      ).toBe(false)
    },
  )

  it('accepts a secure Linux backend', () => {
    expect(
      isSafeStorageUsable({
        backend: 'gnome_libsecret',
        encryptionAvailable: true,
        platform: 'linux',
      }),
    ).toBe(true)
  })

  it('uses the encryption status on other platforms', () => {
    expect(
      isSafeStorageUsable({
        encryptionAvailable: true,
        platform: 'darwin',
      }),
    ).toBe(true)
    expect(
      isSafeStorageUsable({
        encryptionAvailable: false,
        platform: 'win32',
      }),
    ).toBe(false)
  })
})
