import type { HttpConsoleSnapshot } from '~/shared/httpDevtools'
import { ipc } from '@/electron'

const entries = shallowRef<HttpConsoleSnapshot['entries']>([])
const error = ref('')
let initialized = false
let pending = false
let rerun = false
let timer: ReturnType<typeof setTimeout> | undefined
let retentionTimer: ReturnType<typeof setInterval> | undefined
async function refresh() {
  if (pending) {
    rerun = true
    return
  }
  pending = true
  try {
    const snapshot = (await ipc.invoke(
      'spaces:http:console:read',
      undefined,
    )) as HttpConsoleSnapshot
    entries.value = snapshot.entries
    error.value = ''
  }
  catch (cause) {
    error.value = String(cause)
  }
  finally {
    pending = false
    if (rerun) {
      rerun = false
      schedule()
    }
  }
}
function schedule() {
  if (timer)
    return
  timer = setTimeout(() => {
    timer = undefined
    void refresh()
  }, 100)
}
export function useHttpConsole() {
  if (!initialized) {
    initialized = true
    ipc.removeListeners('spaces:http:console:event')
    ipc.on('spaces:http:console:event', schedule)
    retentionTimer = setInterval(() => {
      void refresh()
    }, 60_000)
    void refresh()
  }
  async function clear() {
    await ipc.invoke('spaces:http:console:clear', undefined)
    await refresh()
  }
  return { entries, error, clear, refresh }
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ipc.removeListeners('spaces:http:console:event')
    if (timer)
      clearTimeout(timer)
    if (retentionTimer)
      clearInterval(retentionTimer)
  })
}
