import type { CurrencyRatesStore } from '../types'
import Store from 'electron-store'

export default new Store<CurrencyRatesStore>({
  name: 'currency-rates',
  cwd: 'v2',

  defaults: {
    cache: null,
  },
})
