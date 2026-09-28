import { describe, expect, it, vi } from 'vitest'
import {
  formatVaultDoctorWarning,
  getVaultDoctorWarningKey,
} from '../vaultDoctorWarnings'

describe('formatVaultDoctorWarning', () => {
  it.each([
    'NOTES_LEGACY_ASSET',
    'NOTES_ASSET_MIGRATION_PENDING',
    'NOTES_ASSET_DESTINATION_CONFLICT',
    'NOTES_ASSET_MISSING',
  ])('formats %s through localized message and recommendation keys', (code) => {
    const translate = vi.fn((key: string) => key)

    expect(
      formatVaultDoctorWarning(
        {
          code,
          details: { assetName: 'abcdefghijklmnop.png' },
        },
        translate,
      ),
    ).toEqual({
      message: `preferences:storage.vaultDoctor.assetWarnings.${code}.message`,
      recommendation: `preferences:storage.vaultDoctor.assetWarnings.${code}.recommendation`,
    })
    expect(translate).toHaveBeenCalledWith(expect.any(String), {
      assetName: 'abcdefghijklmnop.png',
    })
  })

  it('falls back to the raw code for other warnings', () => {
    const translate = vi.fn()

    expect(
      formatVaultDoctorWarning({ code: 'DANGLING_FOLDER_ID' }, translate),
    ).toEqual({
      message: 'DANGLING_FOLDER_ID',
      recommendation: null,
    })
    expect(translate).not.toHaveBeenCalled()
  })

  it('creates distinct keys for same-code assets in one note', () => {
    const warning = {
      code: 'NOTES_LEGACY_ASSET',
      path: 'Assets.md',
      space: 'notes',
    }

    expect(
      getVaultDoctorWarningKey({
        ...warning,
        details: { assetName: 'abcdefghijklmnop.png' },
      }),
    ).not.toBe(
      getVaultDoctorWarningKey({
        ...warning,
        details: { assetName: 'ponmlkjihgfedcba.jpg' },
      }),
    )
  })
})
