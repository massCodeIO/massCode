import type { HttpRequestItemResponse } from '@/services/api/generated'
import { emptyHttpRuntime } from '~/shared/httpRuntime'

// The URL editor and runtime editor share one draft without importing each
// other's composables. The owner prevents overrides leaking across requests.
export const requestRuntimeDraft
  = ref<NonNullable<HttpRequestItemResponse['runtime']>>(emptyHttpRuntime())
export const requestRuntimeOwner = ref<string | null>(null)
