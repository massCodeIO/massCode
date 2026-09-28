import type { AiNativeAction } from '~/shared/aiNativeActions'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { useHttpUi } from '@/composables/spaces/http/useHttpUi'
import { runNativeBridge } from './nativeBridges'
import { useAi } from './useAi'

export async function setNativeHttpPanel(
  action: Extract<AiNativeAction, { action: 'httpPanel' | 'httpView' }>,
  current: () => boolean,
) {
  if (!current())
    return { status: 'stale' as const }
  const visible = action.action === 'httpView' || action.visible
  const ui = useHttpUi()
  const panels = useHttpPanels()
  if (action.panel === 'console' || action.panel === 'terminal') {
    ui.dockTab.value = action.panel
    ui.dockOpen.value = visible
  }
  else if (action.panel === 'cookies') {
    ui.cookiesOpen.value = visible
  }
  else if (action.panel === 'environments') {
    ui.environmentsOpen.value = visible
  }
  else if (action.panel === 'inspector') {
    useAi().setOpen(false)
    panels.inspectorOpen.value = visible
  }
  else {
    if (
      [
        'preview',
        'response',
        'responseBody',
        'responseHeaders',
        'responseTests',
        'history',
      ].includes(action.panel)
    ) {
      panels.bottomOpen.value = visible
      await nextTick()
      if (!current())
        return { status: 'stale' as const }
      if (!visible)
        return { status: 'done' as const, panel: action.panel }
    }
    if (!visible)
      return { status: 'unavailable' as const }
    return runNativeBridge(action, current)
  }
  await nextTick()
  return {
    status: current() ? ('done' as const) : ('stale' as const),
    panel: action.panel,
  }
}
