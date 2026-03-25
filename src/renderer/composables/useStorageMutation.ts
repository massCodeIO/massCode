const MUTATION_COOLDOWN_MS = 1500
const EDIT_DEBOUNCE_MS = 1000

let lastMutationTimestamp = 0
let lastEditTimestamp = 0

export function markPersistedStorageMutation(): void {
  lastMutationTimestamp = Date.now()
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
