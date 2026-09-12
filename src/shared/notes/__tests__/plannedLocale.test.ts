import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '../../../main/i18n/locales/en_US/ui.json'
import ru from '../../../main/i18n/locales/ru_RU/ui.json'

describe('planned link localized interpolation', () => {
  it.each([
    ['en', en],
    ['ru', ru],
  ] as const)(
    'interpolates status values in %s using real i18next',
    async (lng, ui) => {
      const instance = i18next.createInstance()
      await instance.init({ lng, resources: { [lng]: { translation: ui } } })
      expect(
        instance.t('internalLinks.planned.status', { type: 'UniqueType' }),
      ).toContain('UniqueType')
    },
  )
})
