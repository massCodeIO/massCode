import { httpRuntimeNavigation } from '@/composables/spaces/http/runtimeNavigation'
import { ipc } from '@/electron'

export function registerLifecycleListener(
  flushMathWrites: () => Promise<void>,
) {
  ipc.on('system:confirm-leave', async (_, payload: { id: number }) => {
    let allowed = false
    try {
      if (await httpRuntimeNavigation.confirmLeave()) {
        await flushMathWrites()
        allowed = true
      }
    }
    catch {
      allowed = false
    }
    finally {
      ipc.send('system:confirm-leave-result', { id: payload.id, allowed })
    }
  })
}
