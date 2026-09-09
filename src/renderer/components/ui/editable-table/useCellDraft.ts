export function useCellDraft(
  value: () => string,
  save: (value: string) => Promise<boolean | void> | boolean | void,
) {
  const draft = ref(value())
  const editing = ref(false)
  const pending = ref(false)
  watch(value, (next) => {
    if (!editing.value && !pending.value)
      draft.value = next
  })
  function focus() {
    editing.value = true
  }
  function cancel() {
    if (pending.value)
      return
    draft.value = value()
    editing.value = false
  }
  async function commit() {
    if (pending.value)
      return
    if (draft.value === value()) {
      editing.value = false
      return true
    }
    const submitted = draft.value
    const previous = value()
    pending.value = true
    try {
      if ((await save(submitted)) === false) {
        editing.value = true
        return false
      }
      draft.value = value() === previous ? submitted : value()
      editing.value = false
      return true
    }
    catch {
      // The owner presents domain-specific errors; preserve the user's input.
      editing.value = true
      return false
    }
    finally {
      pending.value = false
    }
  }
  return { draft, editing, pending, focus, cancel, commit }
}
