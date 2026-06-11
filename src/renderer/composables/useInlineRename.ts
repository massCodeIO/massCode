interface UseInlineRenameOptions {
  // CSS selector of the rename input rendered while editing.
  inputSelector: string
  onRename: (id: string, name: string) => void
}

// Inline "rename in place" behavior shared by sidebar lists (drawings, math
// sheets). State is per-instance on purpose: each list owns its own editing
// session, so it must not be shared on module level.
export function useInlineRename(options: UseInlineRenameOptions) {
  const editingId = ref<string | null>(null)
  const editingName = ref('')
  let pendingMenuRename = false

  function focusInput() {
    nextTick(() => {
      const input = document.querySelector(
        options.inputSelector,
      ) as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
  }

  function startRename(id: string, currentName: string) {
    editingId.value = id
    editingName.value = currentName
    focusInput()
  }

  // Rename triggered from the context menu: defer focusing until the menu has
  // fully closed. Focusing while the menu's focus trap is still active makes
  // reka-ui return focus to the trigger (which closes the input via @blur) and
  // raises an aria-hidden focus warning.
  function requestRenameFromMenu(id: string, currentName: string) {
    editingId.value = id
    editingName.value = currentName
    pendingMenuRename = true
  }

  function handleMenuCloseAutoFocus(event: Event) {
    if (!pendingMenuRename) {
      return
    }

    pendingMenuRename = false
    event.preventDefault()
    focusInput()
  }

  function finishRename(id: string) {
    if (editingId.value !== id) {
      return
    }

    const name = editingName.value.trim()
    editingId.value = null

    if (name) {
      options.onRename(id, name)
    }
  }

  function cancelRename() {
    editingId.value = null
  }

  return {
    editingId,
    editingName,
    startRename,
    requestRenameFromMenu,
    handleMenuCloseAutoFocus,
    finishRename,
    cancelRename,
  }
}
