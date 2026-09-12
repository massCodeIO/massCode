import type { EditorView, ViewUpdate } from '@codemirror/view'
import type { NoteLinkSource } from './creationSource'
import type { InternalLinkMatch, InternalLinkType } from './parser'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { Prec } from '@codemirror/state'
import { keymap, ViewPlugin } from '@codemirror/view'
import { reactive, shallowRef } from 'vue'
import { captureNoteLinkSource } from './creationSource'
import { buildNoteFolderPathMap } from './folderPath'
import {
  buildLinkMarkdown,
  buildPlannedLinkMarkdown,
  getPlannedLinkTarget,
  normalizeInternalLinkLookupKey,
  parseInternalLink,
} from './parser'

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
  folderPath?: string
}

export interface InternalLinkCreationOptions {
  sourceIdentity?: () => { id: number, generation: number } | undefined
  activatePlannedLink?: (
    source: NoteLinkSource,
    type: InternalLinkType,
    query: string,
  ) => unknown
}

interface InternalLinkTriggerOptions extends InternalLinkCreationOptions {
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
let pickerSelectionChanged = false
let pickerCleanupTimer: ReturnType<typeof setTimeout> | null = null

export const internalLinksPickerState = reactive({
  activeIndex: 0,
  anchor: null as InternalLinksPickerAnchor | null,
  isOpen: false,
  items: [] as InternalLinkPickerItem[],
  query: '',
  plan: null as ((type: InternalLinkType) => void) | null,
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
  return /^(?:snippet|note|http-request):\d+\|.*$/.test(payload)
}

/**
 * `text` may be the full document or a single line: positions in the
 * returned match are relative to `text`.
 */
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

  if (
    isStoredInternalLinkPayload(fullPayload)
    || (closingIndex !== -1
      && parseInternalLink(`[[${fullPayload}]]`)?.plannedTarget)
  ) {
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

export function pickShortestUniqueInsertTarget(
  selected: InternalLinkPickerItem,
  items: InternalLinkPickerItem[],
): string {
  if (getPlannedLinkTarget(selected.name))
    return `${selected.type}:${selected.id}`
  if (selected.type === 'snippet') {
    return selected.name
  }

  const selectedKey = normalizeInternalLinkLookupKey(selected.name)
  const hasNameCollision = items.some(
    candidate =>
      candidate !== selected
      && candidate.type === selected.type
      && normalizeInternalLinkLookupKey(candidate.name) === selectedKey,
  )

  if (!hasNameCollision || !selected.folderPath) {
    return selected.name
  }

  return `${selected.folderPath}/${selected.name}`
}

export function buildInternalLinkInsertChange(
  range: InternalLinkSearchMatch,
  target: string,
) {
  return {
    from: range.from,
    insert: buildLinkMarkdown(target),
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
  const [
    { data: snippets },
    { data: notes },
    { data: noteFolders },
    { data: httpRequests },
    { data: httpFolders },
  ] = await Promise.all([
    api.snippets.getSnippets({ search: query, isDeleted: 0 }),
    api.notes.getNotes({ search: query, isDeleted: 0 }),
    api.noteFolders.getNoteFolders(),
    api.httpRequests.getHttpRequests({ search: query }),
    api.httpFolders.getHttpFolders(),
  ])

  const folderPathById = buildNoteFolderPathMap(noteFolders)
  const httpFolderPathById = buildNoteFolderPathMap(httpFolders)

  return [
    ...snippets.map(snippet => ({
      id: snippet.id,
      locationLabel: getLocationLabel(snippet),
      name: snippet.name,
      type: 'snippet' as const,
    })),
    ...httpRequests.map(request => ({
      folderPath:
        request.folderId === null
          ? ''
          : (httpFolderPathById.get(request.folderId) ?? ''),
      id: request.id,
      locationLabel:
        request.folderId === null
          ? i18n.t('spaces.http.title')
          : (httpFolderPathById.get(request.folderId) ?? ''),
      name: request.name,
      type: 'http-request' as const,
    })),
    ...notes.map(note => ({
      folderPath: note.folder ? folderPathById.get(note.folder.id) : undefined,
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
  internalLinksPickerState.plan = null

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
  pickerSelectionChanged = false
  const currentRequestId = ++searchRequestId
  const items = await searchItems(query)

  if (
    currentRequestId !== searchRequestId
    || !internalLinksPickerState.isOpen
  ) {
    return
  }

  const actions = getInternalLinksPickerActions()
  const selectedAction = pickerSelectionChanged
    ? actions[
      internalLinksPickerState.activeIndex
      - internalLinksPickerState.items.length
    ]
    : undefined
  internalLinksPickerState.items = items
  internalLinksPickerState.activeIndex = selectedAction
    ? items.length + actions.indexOf(selectedAction)
    : 0
}

export function getInternalLinksPickerActions() {
  const types: InternalLinkType[] = ['note', 'snippet', 'http-request']
  return internalLinksPickerState.plan
    ? types.map(type => ({ type, key: `plan:${type}` }))
    : []
}

export function setInternalLinksPickerSelection(index: number) {
  pickerSelectionChanged = true
  internalLinksPickerState.activeIndex = index
}

export function moveInternalLinksPickerSelection(delta: number) {
  const count
    = internalLinksPickerState.items.length
      + getInternalLinksPickerActions().length
  if (!count) {
    return
  }

  setInternalLinksPickerSelection(
    (internalLinksPickerState.activeIndex + delta + count) % count,
  )
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

  if (key === 'Mod-Enter') {
    if (!internalLinksPickerState.plan)
      return false
    setInternalLinksPickerSelection(internalLinksPickerState.items.length)
    return true
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
  const selectedIndex = index ?? internalLinksPickerState.activeIndex
  const action
    = getInternalLinksPickerActions()[
      selectedIndex - internalLinksPickerState.items.length
    ]
  if (action) {
    internalLinksPickerState.plan?.(action.type)
    return
  }
  const view = pickerView.value
  const range = pickerRange
  const item = internalLinksPickerState.items[selectedIndex]

  if (!view || !range || !item) {
    return
  }

  const target = pickShortestUniqueInsertTarget(
    item,
    internalLinksPickerState.items,
  )
  const change
    = item.type === 'http-request' || getPlannedLinkTarget(item.name)
      ? {
          from: range.from,
          insert: buildLinkMarkdown(`${item.type}:${item.id}`, item.name),
          to: range.to,
        }
      : buildInternalLinkInsertChange(range, target)

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

  internalLinksPickerState.plan = null
  pickerView.value = view
  pickerRange = match
  internalLinksPickerState.activeIndex = 0
  internalLinksPickerState.anchor = null
  internalLinksPickerState.isOpen = true
  internalLinksPickerState.items = []
  void setInternalLinksPickerQuery(match.query)
}

export interface PlannedLinkActions {
  create: () => void
}
const plannedOwners = new WeakMap<
  EditorView,
  (match: InternalLinkMatch) => PlannedLinkActions | undefined
>()
export function getPlannedLinkActions(
  view: EditorView,
  match: InternalLinkMatch,
) {
  return plannedOwners.get(view)?.(match)
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
      private disposed = false
      captures = new Set<
        NonNullable<ReturnType<typeof captureNoteLinkSource>>
      >()

      constructor(private readonly view: EditorView) {
        if (options.activatePlannedLink && options.sourceIdentity) {
          plannedOwners.set(view, (match) => {
            if (!match.plannedTarget)
              return
            const act = () => {
              if (
                view.state.doc.sliceString(match.from, match.to) !== match.raw
              )
                return
              const capture
                = [...this.captures].find(item => item.matches(match))
                  ?? this.capture(match)
              if (capture) {
                options.activatePlannedLink!(
                  capture.source,
                  match.plannedTarget!.type,
                  match.alias ?? '',
                )
              }
            }
            return { create: act }
          })
        }
      }

      private capture(range: { from: number, to: number }) {
        if (this.disposed)
          return
        const capture = captureNoteLinkSource(
          this.view,
          options.sourceIdentity!,
          range,
          () => {
            if (capture)
              this.captures.delete(capture)
          },
        )
        if (capture)
          this.captures.add(capture)
        return capture
      }

      update(update: ViewUpdate) {
        if (update.docChanged)
          this.captures.forEach(capture => capture.update(update.changes))
        const selection = update.view.state.selection.main

        if (!selection.empty) {
          if (isInternalLinksPickerOwner(this.view)) {
            closeInternalLinksPicker(false)
          }
          return
        }

        // The token state only depends on the current line, so avoid
        // materializing the whole document on every update.
        const line = update.view.state.doc.lineAt(selection.head)
        const tokenState = getInternalLinkTokenState(
          line.text,
          selection.head - line.from,
        )
        const match
          = tokenState.kind === 'search'
            ? {
                anchor: tokenState.match.anchor + line.from,
                from: tokenState.match.from + line.from,
                query: tokenState.match.query,
                to: tokenState.match.to + line.from,
              }
            : null

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
        if (options.activatePlannedLink && options.sourceIdentity) {
          internalLinksPickerState.plan = (type) => {
            if (!isInternalLinksPickerOwner(this.view) || !pickerRange)
              return
            const title
              = internalLinksPickerState.query.trim()
                || i18n.t(`internalLinks.planned.types.${type}`)
            const capture = this.capture(pickerRange)
            if (!capture)
              return
            capture.source.insert(buildPlannedLinkMarkdown(type, title))
            closeInternalLinksPicker(false)
            capture.source.focus()
            capture.source.release()
          }
        }
        this.schedulePopupPosition(match)
      }

      destroy() {
        this.disposed = true
        plannedOwners.delete(this.view)
        this.captures.forEach(capture => capture.invalidate())
        this.captures.clear()
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
          key: 'Mod-Enter',
          run: view =>
            isInternalLinksPickerOwner(view)
            && handleInternalLinksPickerKey('Mod-Enter'),
        },
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
