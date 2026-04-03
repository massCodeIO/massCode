import { openInternalTarget } from '@/ipc/listeners/deepLinks'
import { isMac } from '@/utils'
import { EditorView } from '@codemirror/view'

function isNavigationClick(event: MouseEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey
}

export function findInternalLinkElement(
  target: EventTarget | null,
): HTMLElement | null {
  if (
    !target
    || typeof target !== 'object'
    || !('closest' in target)
    || typeof target.closest !== 'function'
  ) {
    return null
  }

  const link = target.closest('[data-internal-link="true"]')
  if (!link || typeof link !== 'object' || !('dataset' in link)) {
    return null
  }

  return link as HTMLElement
}

function getInternalLinkEditAnchor(link: HTMLElement): number | null {
  const from = Number(link.dataset.internalLinkFrom)

  if (!Number.isFinite(from)) {
    return null
  }

  return from + 1
}

export function handleInternalLinkMouseDown(
  view: Pick<EditorView, 'dispatch' | 'focus'>,
  event: MouseEvent,
  link: HTMLElement,
): boolean {
  if (link.dataset.internalLinkBroken === 'true') {
    return false
  }

  if (isNavigationClick(event)) {
    const type = link.dataset.internalLinkType
    const id = Number(link.dataset.internalLinkId)

    if ((type !== 'snippet' && type !== 'note') || !id) {
      return false
    }

    event.preventDefault()
    void openInternalTarget({ id, type })
    return true
  }

  const anchor = getInternalLinkEditAnchor(link)
  if (anchor === null) {
    return false
  }

  event.preventDefault()
  view.dispatch({
    selection: { anchor },
  })
  view.focus()
  return true
}

export function handleInternalLinkClick(
  event: MouseEvent,
  link: HTMLElement,
): boolean {
  if (link.dataset.internalLinkBroken === 'true') {
    return false
  }

  event.preventDefault()
  return true
}

export function createInternalLinksNavigation() {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const link = findInternalLinkElement(event.target)
      if (!link) {
        return false
      }

      return handleInternalLinkMouseDown(view, event, link)
    },
    click(event) {
      const link = findInternalLinkElement(event.target)
      if (!link) {
        return false
      }

      return handleInternalLinkClick(event, link)
    },
  })
}
