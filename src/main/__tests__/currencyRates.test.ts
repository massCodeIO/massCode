import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrencyRates, refreshFiatRatesForced } from '../currencyRates'

const mocks = vi.hoisted(() => {
  const state: {
    cache: { rates: Record<string, number>, fetchedAt: number } | null
  } = {
    cache: null,
  }

  return {
    state,
    get: vi.fn(() => state.cache),
    set: vi.fn(
      (
        _key: string,
        value: { rates: Record<string, number>, fetchedAt: number },
      ) => {
        state.cache = value
      },
    ),
  }
})

vi.mock('../store', () => ({
  store: {
    currencyRates: {
      get: mocks.get,
      set: mocks.set,
    },
  },
}))

describe('currencyRates', () => {
  beforeEach(() => {
    mocks.state.cache = null
    mocks.get.mockClear()
    mocks.set.mockClear()
    vi.restoreAllMocks()
  })

  it('does not persist partial cold-start rates to cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: 'success',
            rates: {
              EUR: 0.92,
              GBP: 0.79,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        }),
    )

    const payload = await getCurrencyRates()

    expect(payload.source).toBe('live')
    expect(payload.rates).toMatchObject({
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
    })
    expect(mocks.set).not.toHaveBeenCalled()
    expect(mocks.state.cache).toBeNull()
  })

  it('throws when forced fiat refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    )

    await expect(refreshFiatRatesForced()).rejects.toThrow(
      'Currency rates request failed with status 500',
    )
  })
})
