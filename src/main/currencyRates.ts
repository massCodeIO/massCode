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

const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOT: 'polkadot',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  SHIB: 'shiba-inu',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  XLM: 'stellar',
  XMR: 'monero',
  EOS: 'eos',
  TRX: 'tron',
  DASH: 'dash',
  NEO: 'neo',
  BCH: 'bitcoin-cash',
  ETC: 'ethereum-classic',
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

async function fetchFiatRates(): Promise<Record<string, number>> {
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

  return data.rates
}

async function fetchCryptoRates(): Promise<Record<string, number>> {
  const ids = Object.values(CRYPTO_IDS).join(',')
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
  )

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('rate_limit')
    }
    throw new Error(
      `Crypto rates request failed with status ${response.status}`,
    )
  }

  const data = (await response.json()) as Record<string, { usd?: number }>
  const rates: Record<string, number> = {}

  for (const [code, coinId] of Object.entries(CRYPTO_IDS)) {
    const usdPrice = data[coinId]?.usd
    if (usdPrice && usdPrice > 0) {
      rates[code] = 1 / usdPrice
    }
  }

  return rates
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
    const [fiatRates, cryptoRates] = await Promise.allSettled([
      fetchFiatRates(),
      fetchCryptoRates(),
    ])

    const rates: Record<string, number> = {}

    if (fiatRates.status === 'fulfilled') {
      Object.assign(rates, fiatRates.value)
    }

    if (cryptoRates.status === 'fulfilled') {
      Object.assign(rates, cryptoRates.value)
    }

    if (Object.keys(rates).length === 0) {
      throw new Error('No rates fetched')
    }

    const payload = {
      rates: normalizeRates(rates),
      fetchedAt: Date.now(),
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
