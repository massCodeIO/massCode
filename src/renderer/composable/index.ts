import { createFetch } from '@vueuse/core'

export const useApi = createFetch({
  baseUrl: `http://localhost:${import.meta.env.VITE_APP_API_PORT}`
})
