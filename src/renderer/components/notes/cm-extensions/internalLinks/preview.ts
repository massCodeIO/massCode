import type { EditorView } from '@codemirror/view'
import type { CachedEntityData } from './cache'
import type { InternalLinkType } from './parser'
import { ViewPlugin } from '@codemirror/view'
import { reactive, shallowRef } from 'vue'
import { entityCache } from './cache'
import { fetchInternalLinkEntity } from './decorations'

interface InternalLinksPreviewAnchor {
  left: number
  top: number
}

interface InternalLinksPreviewContent {
  body: string
  title: string
  type: InternalLinkType
}

export const internalLinksPreviewState = reactive({
  anchor: null as InternalLinksPreviewAnchor | null,
  content: null as InternalLinksPreviewContent | null,
  isOpen: false,
})

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

  reset() {
    this.hoveringLink = false
    this.hoveringPopup = false
    this.clearOpenTimer()
    this.clearCloseTimer()
  }

  dispose() {
    this.reset()
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

const previewView = shallowRef<EditorView | null>(null)
const previewController = new InternalLinkPreviewController(300)
let hoveredLink: HTMLElement | null = null
let previewCleanupTimer: ReturnType<typeof setTimeout> | null = null

interface ShouldCloseInternalLinksPreviewOnUpdateOptions {
  docChanged: boolean
  isOwner: boolean
  selectionSet: boolean
}

function findInternalLinkElement(
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

function getCacheKey(type: InternalLinkType, id: number) {
  return `${type}:${id}`
}

function buildPreviewContent(
  entity: CachedEntityData,
): InternalLinksPreviewContent {
  return {
    body:
      entity.type === 'snippet'
        ? (entity.firstContent?.value?.trim() ?? '')
        : (entity.contentExcerpt?.trim() ?? ''),
    title: entity.name,
    type: entity.type,
  }
}

export function closeInternalLinksPreview() {
  internalLinksPreviewState.isOpen = false

  if (previewCleanupTimer) {
    clearTimeout(previewCleanupTimer)
  }

  previewCleanupTimer = setTimeout(() => {
    if (internalLinksPreviewState.isOpen) {
      return
    }

    internalLinksPreviewState.anchor = null
    internalLinksPreviewState.content = null
    previewCleanupTimer = null
  }, 180)
}

export function dismissInternalLinksPreview() {
  previewController.reset()
  hoveredLink = null
  closeInternalLinksPreview()
}

export function onInternalLinksPreviewPopupEnter() {
  previewController.enterPopup()
}

export function onInternalLinksPreviewPopupLeave() {
  previewController.leavePopup(() => closeInternalLinksPreview())
}

export function shouldCloseInternalLinksPreviewOnUpdate(
  options: ShouldCloseInternalLinksPreviewOnUpdateOptions,
) {
  if (!options.isOwner) {
    return false
  }

  return options.docChanged || options.selectionSet
}

export function createInternalLinksPreview() {
  const previewPlugin = ViewPlugin.fromClass(
    class {
      private onKeydown = (event: KeyboardEvent) => {
        if ((event.key !== 'Meta' && event.key !== 'Control') || !hoveredLink) {
          return
        }

        const plugin = this.view.plugin(previewPlugin)
        if (!plugin) {
          return
        }

        previewController.enterLink(
          hoveredLink.dataset.internalLinkBroken !== 'true',
          () => {
            if (hoveredLink) {
              void plugin.showPreview(hoveredLink)
            }
          },
        )
      }

      private onKeyup = (event: KeyboardEvent) => {
        if (event.key === 'Meta' || event.key === 'Control') {
          dismissInternalLinksPreview()
        }
      }

      constructor(private readonly view: EditorView) {
        document.addEventListener('keydown', this.onKeydown)
        document.addEventListener('keyup', this.onKeyup)
      }

      update(update: { docChanged: boolean, selectionSet: boolean }) {
        if (
          !shouldCloseInternalLinksPreviewOnUpdate({
            docChanged: update.docChanged,
            isOwner: previewView.value === this.view,
            selectionSet: update.selectionSet,
          })
        ) {
          return
        }

        dismissInternalLinksPreview()
      }

      destroy() {
        document.removeEventListener('keydown', this.onKeydown)
        document.removeEventListener('keyup', this.onKeyup)
        hoveredLink = null

        if (previewView.value === this.view) {
          previewController.dispose()
          closeInternalLinksPreview()
          previewView.value = null
        }
      }

      async showPreview(target: HTMLElement) {
        if (!target.isConnected) {
          return
        }

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

        previewView.value = this.view
        internalLinksPreviewState.anchor = {
          left: target.getBoundingClientRect().left,
          top: target.getBoundingClientRect().bottom + 8,
        }
        internalLinksPreviewState.content = buildPreviewContent(entity.data)
        internalLinksPreviewState.isOpen = true
      }
    },
    {
      eventHandlers: {
        mousedown(event) {
          if (!findInternalLinkElement(event.target)) {
            return
          }

          dismissInternalLinksPreview()
        },
        mouseover(event, view) {
          const link = findInternalLinkElement(event.target)
          if (!link) {
            return
          }

          hoveredLink = link

          if (!event.metaKey && !event.ctrlKey) {
            return
          }

          const plugin = view.plugin(previewPlugin)
          if (!plugin) {
            return
          }

          previewController.enterLink(
            link.dataset.internalLinkBroken !== 'true',
            () => {
              if (hoveredLink) {
                void plugin.showPreview(hoveredLink)
              }
            },
          )
        },
        mouseout(event) {
          if (!findInternalLinkElement(event.target)) {
            return
          }

          hoveredLink = null
          previewController.leaveLink(() => closeInternalLinksPreview())
        },
      },
    },
  )

  return previewPlugin
}
