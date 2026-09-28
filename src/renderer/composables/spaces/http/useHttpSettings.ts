import type { HttpSettings } from '~/main/store/types'
import { store } from '@/electron'

const settings = reactive(store.preferences.get('http') as HttpSettings)

watch(
  settings,
  () => {
    store.preferences.set('http', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

export function useHttpSettings() {
  return {
    settings,
  }
}
