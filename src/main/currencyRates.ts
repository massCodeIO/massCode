import { store } from './store'

const CACHE_TTL = 1000 * 60 * 60

const fallbackCurrencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  RUB: 89.5,
  JPY: 149.5,
  CNY: 7.24,
  CHF: 0.88,
  AUD: 1.53,
  KRW: 1320,
  INR: 83.1,
  BRL: 4.97,
  MXN: 17.15,
  PLN: 4.02,
  SEK: 10.42,
  NOK: 10.55,
  DKK: 6.87,
  CZK: 22.7,
  HUF: 355,
  TRY: 30.2,
  NZD: 1.63,
  SGD: 1.34,
  HKD: 7.82,
  ZAR: 18.6,
  THB: 35.2,
  UAH: 37.5,
  ILS: 3.65,
}

interface CurrencyRatesApiResponse {
  result?: string
  rates?: Record<string, number>
  time_last_update_unix?: number
}

export interface CurrencyRatesPayload {
  rates: Record<string, number>
  fetchedAt: number
  source: 'live' | 'cache' | 'static'
}

function normalizeRates(rates: Record<string, number>) {
  const normalized = { ...fallbackCurrencyRates }

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
      rates: { ...fallbackCurrencyRates },
      fetchedAt: 0,
      source: 'static',
    }
  }
}
