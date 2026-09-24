import type { DockBadgeSource } from '~/main/store/types'
import { ipc, store } from '@/electron'

const source = ref<DockBadgeSource>(
  store.preferences.get<DockBadgeSource>('appearance.dockBadgeSource')
  || 'none',
)
export function useDockBadgePreference() {
  async function setSource(value: DockBadgeSource) {
    store.preferences.set('appearance.dockBadgeSource', value)
    source.value = value
    return ipc.invoke<null, { applied: boolean, count: number }>(
      'system:refresh-dock-badge',
      null,
    )
  }
  return { source, setSource }
}
