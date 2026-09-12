const MUTATION_COOLDOWN_MS = 1500
const EDIT_DEBOUNCE_MS = 1000

const mutationListeners = new Set<() => void>()

export function subscribeStorageMutations(listener: () => void): () => void {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}

let lastMutationTimestamp = 0
let lastEditTimestamp = 0

export function markPersistedStorageMutation(): void {
  lastMutationTimestamp = Date.now()
  for (const listener of mutationListeners) listener()
}

export function markUserEdit(): void {
  lastEditTimestamp = Date.now()
}

export function shouldSkipStorageSyncRefresh(): boolean {
  const now = Date.now()

  if (now - lastMutationTimestamp < MUTATION_COOLDOWN_MS) {
    return true
  }

  if (now - lastEditTimestamp < EDIT_DEBOUNCE_MS) {
    return true
  }

  return false
}

export function useStorageMutation() {
  return {
    markPersistedStorageMutation,
    markUserEdit,
    shouldSkipStorageSyncRefresh,
  }
}
