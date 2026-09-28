import { useDonations } from '@/composables/useDonations'
import { getActiveSpaceId } from '@/spaceDefinitions'

const DEDUP_MS = 500

let listenerAttached = false
let lastCopyAt = 0

export function useCopyTracker() {
  if (listenerAttached) {
    return
  }

  const { incrementCopy } = useDonations()

  function onCopy() {
    const now = Date.now()
    if (now - lastCopyAt < DEDUP_MS) {
      return
    }
    lastCopyAt = now

    const space = getActiveSpaceId()
    if (!space) {
      return
    }

    incrementCopy(space)
  }

  document.addEventListener('copy', onCopy)
  listenerAttached = true
}
