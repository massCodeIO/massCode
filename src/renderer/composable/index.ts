import { createFetch } from '@vueuse/core'
import mitt from 'mitt'
import type { Events } from './types'
import { API_PORT } from '../../config'

export const useApi = createFetch({
  baseUrl: `http://localhost:${API_PORT}`
})

export const emitter = mitt<Events>()
