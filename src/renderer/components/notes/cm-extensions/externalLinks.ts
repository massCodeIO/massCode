import type { NotesEditorMode } from '@/composables/spaces/notes/useNotesApp'
import { ipc } from '@/electron'
import { isMac } from '@/utils'
import {
  EditorView as CodeMirrorEditorView,
  type EditorView,
} from '@codemirror/view'

const markdownLinkRegExp = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const autolinkRegExp = /<(https?:\/\/[^>\s]+|masscode:\/\/[^>\s]+)>/g
const plainUrlRegExp = /(https?:\/\/[^\s)]+)/g

export function extractExternalUrlAtOffset(
  lineText: string,
  offset: number,
): string | null {
  for (const pattern of [markdownLinkRegExp, autolinkRegExp, plainUrlRegExp]) {
    pattern.lastIndex = 0
    let match = pattern.exec(lineText)

    while (match) {
      const from = match.index
      const to = from + match[0].length
      if (offset >= from && offset <= to) {
        return match[1] ?? match[0]
      }

      match = pattern.exec(lineText)
    }
  }

  return null
}

export function isSupportedExternalUrl(url: string): boolean {
  return (
    url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('masscode://')
  )
}

export function isExternalLinkNavigationEnabled(
  mode: NotesEditorMode,
): boolean {
  return mode !== 'raw'
}

function isNavigationClick(event: MouseEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey
}

export function findExternalUrlAtCoords(
  view: Pick<EditorView, 'posAtCoords' | 'state'>,
  coords: { x: number, y: number },
): string | null {
  const pos = view.posAtCoords(coords)
  if (pos === null)
    return null

  const line = view.state.doc.lineAt(pos)
  const url = extractExternalUrlAtOffset(line.text, pos - line.from)

  if (!url || !isSupportedExternalUrl(url)) {
    return null
  }

  return url
}

export function handleExternalLinkMouseDown(
  view: Pick<EditorView, 'posAtCoords' | 'state'>,
  event: MouseEvent,
): boolean {
  if (!isNavigationClick(event)) {
    return false
  }

  const url = findExternalUrlAtCoords(view, {
    x: event.clientX,
    y: event.clientY,
  })

  if (!url) {
    return false
  }

  event.preventDefault()
  void ipc.invoke('system:open-external', url)
  return true
}

export function handleExternalLinkClick(
  view: Pick<EditorView, 'posAtCoords' | 'state'>,
  event: MouseEvent,
): boolean {
  if (!isNavigationClick(event)) {
    return false
  }

  const url = findExternalUrlAtCoords(view, {
    x: event.clientX,
    y: event.clientY,
  })

  if (!url) {
    return false
  }

  event.preventDefault()
  return true
}

export function createExternalLinksNavigation() {
  return CodeMirrorEditorView.domEventHandlers({
    mousedown(event, view) {
      return handleExternalLinkMouseDown(view, event)
    },
    click(event, view) {
      return handleExternalLinkClick(view, event)
    },
  })
}
