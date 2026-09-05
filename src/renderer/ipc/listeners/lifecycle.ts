import { httpRuntimeNavigation } from '@/composables/spaces/http/runtimeNavigation'
import { ipc } from '@/electron'

export function registerLifecycleListener() {
  ipc.on('system:confirm-leave', async (_, payload: { id: number }) => {
    let allowed = false
    try {
      allowed = await httpRuntimeNavigation.confirmLeave()
    }
    catch {
      allowed = false
    }
    finally {
      ipc.send('system:confirm-leave-result', { id: payload.id, allowed })
    }
  })
}
