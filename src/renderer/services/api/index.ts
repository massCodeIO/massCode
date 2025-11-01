import { store } from '@/electron'
import ky from 'ky'
import { Api } from './generated'

const apiPort = store.preferences.get('apiPort')

export const api = new Api({
  baseUrl: `http://localhost:${apiPort}`,
  customFetch: ky,
})
