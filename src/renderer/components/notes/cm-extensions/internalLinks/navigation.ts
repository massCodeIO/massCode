import { openInternalTarget } from '@/ipc/listeners/deepLinks'
import { isMac } from '@/utils'
import { EditorView } from '@codemirror/view'

function isNavigationClick(event: MouseEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey
}

export function createInternalLinksNavigation() {
  return EditorView.domEventHandlers({
    click(event) {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return false
      }

      const link = target.closest('[data-internal-link="true"]')
      if (!(link instanceof HTMLElement)) {
        return false
      }

      if (
        link.dataset.internalLinkBroken === 'true'
        || !isNavigationClick(event)
      ) {
        return false
      }

      const type = link.dataset.internalLinkType
      const id = Number(link.dataset.internalLinkId)

      if ((type !== 'snippet' && type !== 'note') || !id) {
        return false
      }

      event.preventDefault()
      void openInternalTarget({ id, type })
      return true
    },
  })
}
