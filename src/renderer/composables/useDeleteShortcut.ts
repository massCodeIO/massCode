import { useEventListener } from '@vueuse/core'

interface UseDeleteShortcutOptions {
  rootSelector?: string
  isEnabled: () => boolean
  onDelete: () => Promise<void> | void
}

const IGNORED_DELETE_SHORTCUT_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="dialog"]',
  '[role="menuitem"]',
  '[role="textbox"]',
].join(', ')

function isDeleteShortcut(event: KeyboardEvent) {
  return event.key === 'Delete' || (event.metaKey && event.key === 'Backspace')
}

function shouldIgnoreDeleteShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable
    || Boolean(target.closest(IGNORED_DELETE_SHORTCUT_TARGET_SELECTOR))
  )
}

function isInsideShortcutRoot(
  target: EventTarget | null,
  rootSelector: string | undefined,
) {
  if (!rootSelector) {
    return true
  }

  if (!(target instanceof HTMLElement)) {
    return true
  }

  return (
    target === document.body
    || target === document.documentElement
    || Boolean(target.closest(rootSelector))
  )
}

export function useDeleteShortcut(options: UseDeleteShortcutOptions) {
  useEventListener(window, 'keydown', async (event) => {
    if (event.defaultPrevented || !isDeleteShortcut(event)) {
      return
    }

    if (
      shouldIgnoreDeleteShortcutTarget(event.target)
      || !isInsideShortcutRoot(event.target, options.rootSelector)
      || !options.isEnabled()
    ) {
      return
    }

    event.preventDefault()
    await options.onDelete()
  })
}
