import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const preferences = vi.hoisted(() => ({
  get: vi.fn((key: string) =>
    key === 'localization.locale' ? 'ru_RU' : undefined,
  ),
  set: vi.fn(),
}))
vi.mock('@/electron', () => ({ store: { preferences } }))
vi.stubGlobal('ref', ref)

let dates: ReturnType<(typeof import('../useDateFormat'))['useDateFormat']>
const date = new Date(2026, 10, 23, 14, 5, 9)

async function loadDates(locale: unknown, savedFormat: unknown = undefined) {
  vi.resetModules()
  preferences.get.mockImplementation(
    key =>
      (key === 'localization.locale' ? locale : savedFormat) as
      | string
      | undefined,
  )
  return (await import('../useDateFormat')).useDateFormat()
}

beforeEach(async () => {
  dates = await loadDates('ru_RU')
})

describe('date formatting', () => {
  it('defaults to the application locale', () => {
    expect(dates.dateFormat.value).toBe('locale')
    expect(dates.formatDate(date)).toBe('23.11.2026')
  })

  it.each([
    ['en_US', '1/5/2026'],
    ['en_GB', '1/5/2026'],
    ['ru_RU', '05.01.2026'],
    ['de_DE', '5.1.2026'],
    ['ja_JP', '2026/1/5'],
  ])('uses the default numeric date for %s', async (locale, expected) => {
    dates = await loadDates(locale)
    expect(dates.formatDate(new Date(2026, 0, 5))).toBe(expected)
  })

  it.each([
    ['dd.MM.yyyy', '23.11.2026'],
    ['MM/dd/yyyy', '11/23/2026'],
    ['dd/MM/yyyy', '23/11/2026'],
    ['yyyy-MM-dd', '2026-11-23'],
  ])('applies and persists %s', (pattern, expected) => {
    dates.setDateFormat(pattern)
    expect(dates.formatDate(date)).toBe(expected)
    expect(dates.formatDate('2026-11-23')).toBe(expected)
    expect(dates.formatDateTime(date)).toBe(`${expected} 14:05:09`)
    expect(preferences.set).toHaveBeenLastCalledWith(
      'appearance.dateFormat',
      pattern,
    )
  })

  it('ignores unsupported formats and handles invalid dates', () => {
    dates.setDateFormat('invalid')
    expect(dates.dateFormat.value).toBe('locale')
    expect(dates.formatDate('invalid')).toBe('')
    expect(dates.formatDateTime(Number.NaN)).toBe('')
  })
  it.each(['C', 'unknown', 'toString', '', undefined])(
    'falls back for unsupported language %s',
    async (locale) => {
      dates = await loadDates(locale)
      expect(dates.locale).toBe('en-US')
      expect(dates.formatDate(date)).toBe('11/23/2026')
    },
  )

  it('reuses the formatter without reading preferences during rendering', () => {
    const getCalls = preferences.get.mock.calls.length
    const constructor = vi.spyOn(Intl, 'DateTimeFormat')
    for (let index = 0; index < 371; index++)
      expect(dates.formatDate(date)).toBe('23.11.2026')
    expect(preferences.get).toHaveBeenCalledTimes(getCalls)
    expect(constructor).not.toHaveBeenCalled()
    constructor.mockRestore()
  })

  it('loads the saved format and shares reactive changes', async () => {
    dates = await loadDates('ru_RU', 'yyyy-MM-dd')
    const { computed } = await import('vue')
    const label = computed(() => dates.formatDate(date))
    expect(label.value).toBe('2026-11-23')
    const other = (await import('../useDateFormat')).useDateFormat()
    other.setDateFormat('dd/MM/yyyy')
    expect(label.value).toBe('23/11/2026')
  })
})
