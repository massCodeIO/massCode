import { ipc } from '@/electron'
import { createSharedComposable } from '@vueuse/core'

export const useHttpCookieRevision = createSharedComposable(() => {
  const revision = ref(0)
  ipc.on('spaces:http:cookies:event', () => revision.value++)
  onScopeDispose(() => ipc.removeListeners('spaces:http:cookies:event'))
  return revision
})
