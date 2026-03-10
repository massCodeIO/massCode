import { store } from './store'

const CACHE_TTL = 1000 * 60 * 60

interface CurrencyRatesApiResponse {
  result?: string
  rates?: Record<string, number>
  time_last_update_unix?: number
}

export interface CurrencyRatesPayload {
  rates: Record<string, number>
  fetchedAt: number
  source: 'live' | 'cache' | 'unavailable'
}

function normalizeRates(rates: Record<string, number>) {
  const normalized: Record<string, number> = { USD: 1 }

  Object.entries(rates).forEach(([code, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[code] = value
    }
  })

  normalized.USD = 1

  return normalized
}

export async function getCurrencyRates(): Promise<CurrencyRatesPayload> {
  const cached = store.currencyRates.get('cache')

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return {
      ...cached,
      source: 'cache',
    }
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!response.ok) {
      throw new Error(
        `Currency rates request failed with status ${response.status}`,
      )
    }

    const data = (await response.json()) as CurrencyRatesApiResponse
    if (data.result !== 'success' || !data.rates) {
      throw new Error('Currency rates response is invalid')
    }

    const payload = {
      rates: normalizeRates(data.rates),
      fetchedAt: data.time_last_update_unix
        ? data.time_last_update_unix * 1000
        : Date.now(),
    }

    store.currencyRates.set('cache', payload)

    return {
      ...payload,
      source: 'live',
    }
  }
  catch {
    if (cached) {
      return {
        ...cached,
        source: 'cache',
      }
    }

    return {
      rates: {},
      fetchedAt: 0,
      source: 'unavailable',
    }
  }
}
