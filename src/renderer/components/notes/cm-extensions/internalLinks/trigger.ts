import type { EditorView } from '@codemirror/view'
import type { InternalLinkType } from './parser'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { ViewPlugin } from '@codemirror/view'
import { buildLinkMarkdown } from './parser'

type InternalLinksMode = 'raw' | 'livePreview' | 'preview'

export interface InternalLinkTriggerRange {
  from: number
  to: number
}

export interface InternalLinkPickerItem {
  id: number
  name: string
  type: InternalLinkType
  locationLabel: string
}

interface InternalLinkTriggerOptions {
  mode: InternalLinksMode
  editable: boolean
}

interface SearchableEntity {
  id: number
  name: string
  folder: { id: number, name: string } | null
  isDeleted: number
}

export function isInternalLinkPickerEnabled(
  mode: InternalLinksMode,
  editable: boolean,
): boolean {
  return editable && mode !== 'preview'
}

export function findInternalLinkTriggerRange(
  text: string,
  head: number,
): InternalLinkTriggerRange | null {
  if (head < 2) {
    return null
  }

  if (text.slice(head - 2, head) !== '[[') {
    return null
  }

  return {
    from: head - 2,
    to: head,
  }
}

export function buildInternalLinkInsertChange(
  range: InternalLinkTriggerRange,
  item: {
    id: number
    label: string
    type: InternalLinkType
  },
) {
  return {
    from: range.from,
    to: range.to,
    insert: buildLinkMarkdown(item.type, item.id, item.label),
  }
}

function getLocationLabel(entity: SearchableEntity): string {
  if (entity.folder) {
    return entity.folder.name
  }

  if (entity.isDeleted) {
    return i18n.t('common.trash')
  }

  return i18n.t('common.inbox')
}

function createTypeIcon(type: InternalLinkType): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.classList.add('cm-internal-link-picker__icon')

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute(
    'd',
    type === 'snippet'
      ? 'M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12'
      : 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
  )
  svg.append(path)

  if (type === 'note') {
    const second = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    )
    second.setAttribute('d', 'M14 2v6h6M8 13h8M8 17h5')
    svg.append(second)
  }

  return svg
}

function renderPickerItem(
  item: InternalLinkPickerItem,
  isActive: boolean,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `cm-internal-link-picker__item${isActive ? ' is-active' : ''}`

  const titleRow = document.createElement('span')
  titleRow.className = 'cm-internal-link-picker__title-row'
  titleRow.append(createTypeIcon(item.type))

  const name = document.createElement('span')
  name.className = 'cm-internal-link-picker__name'
  name.textContent = item.name
  titleRow.append(name)

  const location = document.createElement('span')
  location.className = 'cm-internal-link-picker__location'
  location.textContent = item.locationLabel

  button.append(titleRow, location)
  return button
}

function renderGroupTitle(title: string): HTMLElement {
  const element = document.createElement('div')
  element.className = 'cm-internal-link-picker__group-title'
  element.textContent = title
  return element
}

async function searchItems(query: string): Promise<InternalLinkPickerItem[]> {
  const [{ data: snippets }, { data: notes }] = await Promise.all([
    api.snippets.getSnippets({ search: query, isDeleted: 0 }),
    api.notes.getNotes({ search: query, isDeleted: 0 }),
  ])

  return [
    ...snippets.map(snippet => ({
      id: snippet.id,
      locationLabel: getLocationLabel(snippet),
      name: snippet.name,
      type: 'snippet' as const,
    })),
    ...notes.map(note => ({
      id: note.id,
      locationLabel: getLocationLabel(note),
      name: note.name,
      type: 'note' as const,
    })),
  ]
}

export function createInternalLinksTrigger(
  options: InternalLinkTriggerOptions,
) {
  const enabled = isInternalLinkPickerEnabled(options.mode, options.editable)

  if (!enabled) {
    return []
  }

  return ViewPlugin.fromClass(
    class {
      private popup: HTMLDivElement | null = null
      private input: HTMLInputElement | null = null
      private itemsHost: HTMLDivElement | null = null
      private items: InternalLinkPickerItem[] = []
      private activeIndex = 0
      private triggerRange: InternalLinkTriggerRange | null = null
      private searchRequestId = 0
      private removeDocumentListeners: (() => void) | null = null

      constructor(private readonly view: EditorView) {}

      update(update: {
        docChanged: boolean
        selectionSet: boolean
        view: EditorView
      }) {
        if (this.popup) {
          this.schedulePopupPosition()
        }

        if (this.popup || (!update.docChanged && !update.selectionSet)) {
          return
        }

        const head = update.view.state.selection.main.head
        if (!update.view.state.selection.main.empty) {
          return
        }

        const range = findInternalLinkTriggerRange(
          update.view.state.doc.toString(),
          head,
        )

        if (!range) {
          return
        }

        this.open(range)
      }

      destroy() {
        this.close(false)
      }

      private open(range: InternalLinkTriggerRange) {
        this.triggerRange = range
        this.popup = document.createElement('div')
        this.popup.className = 'cm-internal-link-picker'

        this.input = document.createElement('input')
        this.input.className = 'cm-internal-link-picker__input'
        this.input.type = 'text'
        this.input.placeholder = i18n.t(
          'internalLinks.picker.searchPlaceholder',
        )

        this.itemsHost = document.createElement('div')
        this.itemsHost.className = 'cm-internal-link-picker__results'

        this.popup.append(this.input, this.itemsHost)
        document.body.append(this.popup)
        this.schedulePopupPosition()

        const onDocumentMouseDown = (event: MouseEvent) => {
          const target = event.target
          if (!(target instanceof Node)) {
            return
          }

          if (this.popup?.contains(target) || this.view.dom.contains(target)) {
            return
          }

          this.close(true)
        }

        document.addEventListener('mousedown', onDocumentMouseDown)
        this.removeDocumentListeners = () => {
          document.removeEventListener('mousedown', onDocumentMouseDown)
        }

        this.input.addEventListener('input', () => {
          void this.refreshResults(this.input?.value ?? '')
        })

        this.input.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            this.moveSelection(1)
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            this.moveSelection(-1)
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            this.insertSelected()
            return
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            this.close(true)
          }
        })

        requestAnimationFrame(() => {
          this.input?.focus()
        })

        void this.refreshResults('')
      }

      private schedulePopupPosition() {
        if (!this.popup || !this.triggerRange) {
          return
        }

        const popup = this.popup
        const position = this.triggerRange.to

        this.view.requestMeasure({
          read: view => view.coordsAtPos(position),
          write: (coords) => {
            if (!popup || !this.popup || popup !== this.popup || !coords) {
              return
            }

            popup.style.left = `${coords.left}px`
            popup.style.top = `${coords.bottom + 6}px`
          },
        })
      }

      private async refreshResults(query: string) {
        if (!this.itemsHost) {
          return
        }

        const requestId = ++this.searchRequestId
        this.itemsHost.textContent = ''

        const items = await searchItems(query)
        if (requestId !== this.searchRequestId) {
          return
        }

        this.items = items
        this.activeIndex = 0
        this.renderItems()
      }

      private renderItems() {
        if (!this.itemsHost) {
          return
        }

        this.itemsHost.textContent = ''

        const snippets = this.items.filter(item => item.type === 'snippet')
        const notes = this.items.filter(item => item.type === 'note')

        const groups: Array<[string, InternalLinkPickerItem[]]> = [
          [i18n.t('internalLinks.picker.groups.snippets'), snippets],
          [i18n.t('internalLinks.picker.groups.notes'), notes],
        ]

        let absoluteIndex = 0

        for (const [title, items] of groups) {
          if (!items.length) {
            continue
          }

          this.itemsHost.append(renderGroupTitle(title))

          for (const item of items) {
            const button = renderPickerItem(
              item,
              absoluteIndex === this.activeIndex,
            )
            const index = absoluteIndex
            button.addEventListener('mousedown', (event) => {
              event.preventDefault()
              this.activeIndex = index
              this.insertSelected()
            })
            this.itemsHost.append(button)
            absoluteIndex++
          }
        }

        if (!absoluteIndex) {
          const empty = document.createElement('div')
          empty.className = 'cm-internal-link-picker__empty'
          empty.textContent = i18n.t('internalLinks.picker.emptyResults')
          this.itemsHost.append(empty)
        }
      }

      private moveSelection(delta: number) {
        if (!this.items.length) {
          return
        }

        this.activeIndex
          = (this.activeIndex + delta + this.items.length) % this.items.length
        this.renderItems()
      }

      private insertSelected() {
        if (!this.triggerRange) {
          return
        }

        const selected = this.items[this.activeIndex]
        if (!selected) {
          return
        }

        this.view.dispatch({
          changes: buildInternalLinkInsertChange(this.triggerRange, {
            id: selected.id,
            label: selected.name,
            type: selected.type,
          }),
          selection: {
            anchor:
              this.triggerRange.from
              + buildLinkMarkdown(selected.type, selected.id, selected.name)
                .length,
          },
        })

        this.close(true)
      }

      private close(restoreFocus: boolean) {
        this.removeDocumentListeners?.()
        this.removeDocumentListeners = null

        this.popup?.remove()
        this.popup = null
        this.input = null
        this.itemsHost = null
        this.items = []
        this.activeIndex = 0
        this.triggerRange = null

        if (restoreFocus) {
          this.view.focus()
        }
      }
    },
  )
}
