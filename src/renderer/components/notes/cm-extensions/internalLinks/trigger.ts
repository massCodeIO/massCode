import type { EditorView } from '@codemirror/view'
import type { InternalLinkType } from './parser'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { Prec } from '@codemirror/state'
import { keymap, ViewPlugin } from '@codemirror/view'
import { reactive, shallowRef } from 'vue'
import { buildLinkMarkdown, parseInternalLink } from './parser'

type InternalLinksMode = 'raw' | 'livePreview' | 'preview'

export interface InternalLinkTriggerRange {
  from: number
  to: number
}

export interface InternalLinkSearchMatch extends InternalLinkTriggerRange {
  anchor: number
  query: string
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

interface InternalLinksPickerAnchor {
  left: number
  top: number
}

interface InternalLinksPickerCoords {
  bottom: number
  left: number
}

interface ShouldOpenInternalLinksPickerOptions {
  docChanged: boolean
  isOpen: boolean
  selectionSet: boolean
}

type InternalLinkTokenState =
  | { kind: 'closed' }
  | { kind: 'stored_link' }
  | { kind: 'search', match: InternalLinkSearchMatch }

const pickerView = shallowRef<EditorView | null>(null)
let pickerRange: InternalLinkSearchMatch | null = null
let searchRequestId = 0
let pickerCleanupTimer: ReturnType<typeof setTimeout> | null = null

export const internalLinksPickerState = reactive({
  activeIndex: 0,
  anchor: null as InternalLinksPickerAnchor | null,
  isOpen: false,
  items: [] as InternalLinkPickerItem[],
  query: '',
})

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

export function findInternalLinkSearchMatch(
  text: string,
  head: number,
): InternalLinkSearchMatch | null {
  const state = getInternalLinkTokenState(text, head)

  return state.kind === 'search' ? state.match : null
}

function isStoredInternalLinkPayload(payload: string): boolean {
  return /^(?:snippet|note):\d+\|.*$/.test(payload)
}

export function getInternalLinkTokenState(
  text: string,
  head: number,
): InternalLinkTokenState {
  const lineStart = text.lastIndexOf('\n', Math.max(0, head - 1)) + 1
  const lineEndIndex = text.indexOf('\n', head)
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex
  const linePrefix = text.slice(lineStart, head)
  const triggerIndex = linePrefix.lastIndexOf('[[')

  if (triggerIndex === -1) {
    return { kind: 'closed' }
  }

  const from = lineStart + triggerIndex
  const tokenAfterTrigger = text.slice(from + 2, lineEnd)
  const closingIndex = tokenAfterTrigger.indexOf(']]')
  const fullPayload
    = closingIndex === -1
      ? tokenAfterTrigger
      : tokenAfterTrigger.slice(0, closingIndex)
  const rawPayload = text.slice(from + 2, head)
  const headOffset = head - (from + 2)
  const linkEnd = closingIndex === -1 ? head : from + 2 + closingIndex + 2

  if (rawPayload.includes(']') || rawPayload.includes('\n')) {
    return { kind: 'closed' }
  }

  if (isStoredInternalLinkPayload(fullPayload)) {
    return { kind: 'stored_link' }
  }

  if (closingIndex !== -1 && parseInternalLink(`[[${fullPayload}]]`)) {
    const aliasIndex = fullPayload.indexOf('|')
    const targetEnd = aliasIndex === -1 ? fullPayload.length : aliasIndex

    if (headOffset <= targetEnd) {
      return {
        kind: 'search',
        match: {
          anchor: head,
          from,
          query: fullPayload.slice(0, targetEnd),
          to: linkEnd,
        },
      }
    }

    return { kind: 'stored_link' }
  }

  if (rawPayload.includes('|')) {
    return { kind: 'closed' }
  }

  return {
    kind: 'search',
    match: {
      anchor: head,
      from,
      query: rawPayload,
      to: head,
    },
  }
}

export function buildInternalLinkInsertChange(
  range: InternalLinkSearchMatch,
  item: {
    id: number
    label: string
    type: InternalLinkType
  },
) {
  return {
    from: range.from,
    insert: buildLinkMarkdown(item.label),
    to: range.to,
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

export function setInternalLinksPickerAnchor(
  anchor: InternalLinksPickerAnchor | null,
) {
  if (!internalLinksPickerState.isOpen) {
    return
  }

  internalLinksPickerState.anchor = anchor
}

export function closeInternalLinksPicker(restoreFocus = true) {
  const view = pickerView.value
  const activeAnchor = internalLinksPickerState.anchor

  internalLinksPickerState.activeIndex = 0
  internalLinksPickerState.isOpen = false

  if (pickerCleanupTimer) {
    clearTimeout(pickerCleanupTimer)
  }

  pickerCleanupTimer = setTimeout(() => {
    if (internalLinksPickerState.isOpen) {
      return
    }

    internalLinksPickerState.anchor = null
    internalLinksPickerState.items = []
    internalLinksPickerState.query = ''
    pickerRange = null
    pickerView.value = null
    pickerCleanupTimer = null
  }, 180)

  internalLinksPickerState.anchor = activeAnchor

  if (restoreFocus) {
    view?.focus()
  }
}

export async function setInternalLinksPickerQuery(query: string) {
  internalLinksPickerState.query = query
  const currentRequestId = ++searchRequestId
  const items = await searchItems(query)

  if (
    currentRequestId !== searchRequestId
    || !internalLinksPickerState.isOpen
  ) {
    return
  }

  internalLinksPickerState.items = items
  internalLinksPickerState.activeIndex = 0
}

export function moveInternalLinksPickerSelection(delta: number) {
  if (!internalLinksPickerState.items.length) {
    return
  }

  internalLinksPickerState.activeIndex
    = (internalLinksPickerState.activeIndex
      + delta
      + internalLinksPickerState.items.length)
    % internalLinksPickerState.items.length
}

export function getInternalLinksPickerAnchorFromCoords(
  coords: InternalLinksPickerCoords,
): InternalLinksPickerAnchor {
  return {
    left: coords.left,
    top: coords.bottom,
  }
}

export function handleInternalLinksPickerKey(key: string): boolean {
  if (!internalLinksPickerState.isOpen) {
    return false
  }

  if (key === 'ArrowDown') {
    moveInternalLinksPickerSelection(1)
    return true
  }

  if (key === 'ArrowUp') {
    moveInternalLinksPickerSelection(-1)
    return true
  }

  if (key === 'Enter') {
    selectInternalLinksPickerItem()
    return true
  }

  if (key === 'Escape') {
    closeInternalLinksPicker(false)
    return true
  }

  return false
}

export function shouldOpenInternalLinksPicker(
  options: ShouldOpenInternalLinksPickerOptions,
): boolean {
  if (options.isOpen) {
    return options.docChanged || options.selectionSet
  }

  return options.docChanged
}

export function selectInternalLinksPickerItem(index?: number) {
  const view = pickerView.value
  const range = pickerRange
  const item
    = internalLinksPickerState.items[
      index ?? internalLinksPickerState.activeIndex
    ]

  if (!view || !range || !item) {
    return
  }

  const change = buildInternalLinkInsertChange(range, {
    id: item.id,
    label: item.name,
    type: item.type,
  })

  view.dispatch({
    changes: change,
    selection: {
      anchor: range.from + change.insert.length,
    },
  })

  closeInternalLinksPicker(true)
}

export function isInternalLinksPickerOwner(view: EditorView): boolean {
  return pickerView.value === view
}

function openInternalLinksPicker(
  view: EditorView,
  match: InternalLinkSearchMatch,
) {
  if (pickerCleanupTimer) {
    clearTimeout(pickerCleanupTimer)
    pickerCleanupTimer = null
  }

  pickerView.value = view
  pickerRange = match
  internalLinksPickerState.activeIndex = 0
  internalLinksPickerState.anchor = null
  internalLinksPickerState.isOpen = true
  internalLinksPickerState.items = []
  void setInternalLinksPickerQuery(match.query)
}

export function createInternalLinksTrigger(
  options: InternalLinkTriggerOptions,
) {
  const enabled = isInternalLinkPickerEnabled(options.mode, options.editable)

  if (!enabled) {
    return []
  }

  const plugin = ViewPlugin.fromClass(
    class {
      constructor(private readonly view: EditorView) {}

      update(update: {
        docChanged: boolean
        selectionSet: boolean
        view: EditorView
      }) {
        const selection = update.view.state.selection.main

        if (!selection.empty) {
          if (isInternalLinksPickerOwner(this.view)) {
            closeInternalLinksPicker(false)
          }
          return
        }

        const tokenState = getInternalLinkTokenState(
          update.view.state.doc.toString(),
          selection.head,
        )
        const match = tokenState.kind === 'search' ? tokenState.match : null

        if (
          isInternalLinksPickerOwner(this.view)
          && internalLinksPickerState.isOpen
        ) {
          if (!match) {
            closeInternalLinksPicker(false)
            return
          }

          pickerRange = match
          if (internalLinksPickerState.query !== match.query) {
            void setInternalLinksPickerQuery(match.query)
          }
          this.schedulePopupPosition(match)
          return
        }

        if (
          !match
          || !shouldOpenInternalLinksPicker({
            docChanged: update.docChanged,
            isOpen: false,
            selectionSet: update.selectionSet,
          })
        ) {
          return
        }

        openInternalLinksPicker(this.view, match)
        this.schedulePopupPosition(match)
      }

      destroy() {
        if (isInternalLinksPickerOwner(this.view)) {
          closeInternalLinksPicker(false)
        }
      }

      private schedulePopupPosition(match: InternalLinkSearchMatch) {
        if (!isInternalLinksPickerOwner(this.view)) {
          return
        }

        this.view.requestMeasure({
          read: view => view.coordsAtPos(match.anchor),
          write: (coords) => {
            if (!coords || !isInternalLinksPickerOwner(this.view)) {
              return
            }

            setInternalLinksPickerAnchor(
              getInternalLinksPickerAnchorFromCoords(coords),
            )
          },
        })
      }
    },
  )

  return [
    plugin,
    Prec.highest(
      keymap.of([
        {
          any(view, event) {
            if (!isInternalLinksPickerOwner(view)) {
              return false
            }

            const handled = handleInternalLinksPickerKey(event.key)
            if (!handled) {
              return false
            }

            return true
          },
        },
      ]),
    ),
  ]
}
