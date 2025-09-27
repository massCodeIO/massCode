import ky from 'ky'
import { Api } from './generated'

export const api = new Api({
  baseUrl: 'http://localhost:4321',
  customFetch: ky,
})
