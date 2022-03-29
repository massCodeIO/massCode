import { createFetch } from '@vueuse/core'
import mitt from 'mitt'
import type { Events } from './types'

export const useApi = createFetch({
  baseUrl: `http://localhost:${import.meta.env.VITE_APP_API_PORT}`
})

export const emitter = mitt<Events>()
