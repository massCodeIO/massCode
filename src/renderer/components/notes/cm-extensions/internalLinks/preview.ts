import type { EditorView } from '@codemirror/view'
import type { CachedEntityData } from './cache'
import type { InternalLinkType } from './parser'
import { ViewPlugin } from '@codemirror/view'
import { entityCache } from './cache'
import { fetchInternalLinkEntity } from './decorations'

export class InternalLinkPreviewController {
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private hoveringLink = false
  private hoveringPopup = false

  constructor(private readonly delayMs = 300) {}

  enterLink(canOpen: boolean, onOpen: () => void) {
    this.hoveringLink = true
    this.clearCloseTimer()

    if (!canOpen) {
      this.clearOpenTimer()
      return
    }

    this.clearOpenTimer()
    this.openTimer = setTimeout(() => {
      this.openTimer = null
      if (this.hoveringLink) {
        onOpen()
      }
    }, this.delayMs)
  }

  leaveLink(onClose: () => void) {
    this.hoveringLink = false
    this.scheduleClose(onClose)
  }

  enterPopup() {
    this.hoveringPopup = true
    this.clearCloseTimer()
  }

  leavePopup(onClose: () => void) {
    this.hoveringPopup = false
    this.scheduleClose(onClose)
  }

  dispose() {
    this.clearOpenTimer()
    this.clearCloseTimer()
  }

  private scheduleClose(onClose: () => void) {
    if (this.hoveringLink || this.hoveringPopup) {
      return
    }

    this.clearCloseTimer()
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null
      if (!this.hoveringLink && !this.hoveringPopup) {
        onClose()
      }
    }, this.delayMs)
  }

  private clearOpenTimer() {
    if (!this.openTimer) {
      return
    }

    clearTimeout(this.openTimer)
    this.openTimer = null
  }

  private clearCloseTimer() {
    if (!this.closeTimer) {
      return
    }

    clearTimeout(this.closeTimer)
    this.closeTimer = null
  }
}

function getCacheKey(type: InternalLinkType, id: number) {
  return `${type}:${id}`
}

function buildPreviewContent(entity: CachedEntityData): HTMLElement {
  const root = document.createElement('div')
  root.className = 'cm-internal-link-preview__content'

  const title = document.createElement('div')
  title.className = 'cm-internal-link-preview__title'
  title.textContent = entity.name
  root.append(title)

  const previewValue
    = entity.type === 'snippet'
      ? (entity.firstContent?.value?.trim() ?? '')
      : (entity.contentExcerpt?.trim() ?? '')

  if (!previewValue) {
    return root
  }

  const body = document.createElement(
    entity.type === 'snippet' ? 'pre' : 'div',
  )
  body.className = 'cm-internal-link-preview__body'
  body.textContent = previewValue
  root.append(body)

  return root
}

export function createInternalLinksPreview() {
  const previewPlugin = ViewPlugin.fromClass(
    class {
      private popup: HTMLDivElement | null = null
      private controller = new InternalLinkPreviewController(300)
      private hoveredLink: HTMLElement | null = null

      constructor(private readonly view: EditorView) {}

      destroy() {
        this.controller.dispose()
        this.removePopup()
      }

      private async showPopup(target: HTMLElement) {
        const type = target.dataset.internalLinkType as
          | InternalLinkType
          | undefined
        const id = Number(target.dataset.internalLinkId)

        if (!type || !id || target.dataset.internalLinkBroken === 'true') {
          return
        }

        const key = getCacheKey(type, id)
        let entity = entityCache.get(key)

        if (!entity) {
          entity = await fetchInternalLinkEntity(type, id)
          entityCache.set(key, entity)
        }

        if (!entity.exists) {
          return
        }

        this.removePopup()

        const popup = document.createElement('div')
        popup.className = 'cm-internal-link-preview'
        popup.append(buildPreviewContent(entity.data))
        popup.addEventListener('mouseenter', () =>
          this.controller.enterPopup())
        popup.addEventListener('mouseleave', () =>
          this.controller.leavePopup(() => this.removePopup()))

        this.view.dom.append(popup)

        const rect = target.getBoundingClientRect()
        popup.style.left = `${rect.left}px`
        popup.style.top = `${rect.bottom + 8}px`
        this.popup = popup
      }

      private removePopup() {
        this.popup?.remove()
        this.popup = null
      }
    },
    {
      eventHandlers: {
        mouseover(event, view) {
          const target = event.target
          if (!(target instanceof HTMLElement)) {
            return
          }

          const link = target.closest('[data-internal-link="true"]')
          if (!(link instanceof HTMLElement)) {
            return
          }

          const plugin = view.plugin(previewPlugin)
          if (!plugin) {
            return
          }

          plugin.hoveredLink = link
          plugin.controller.enterLink(
            link.dataset.internalLinkBroken !== 'true',
            () => {
              if (plugin.hoveredLink) {
                void plugin.showPopup(plugin.hoveredLink)
              }
            },
          )
        },
        mouseout(event, view) {
          const target = event.target
          if (!(target instanceof HTMLElement)) {
            return
          }

          if (!target.closest('[data-internal-link="true"]')) {
            return
          }

          const plugin = view.plugin(previewPlugin)
          if (!plugin) {
            return
          }

          plugin.hoveredLink = null
          plugin.controller.leaveLink(() => plugin.removePopup())
        },
      },
    },
  )

  return previewPlugin
}
