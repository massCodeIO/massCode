import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { parseMarkdownTable } from './tableParser'

export interface TableBlockRange {
  from: number
  to: number
}

function getTableBlockRanges(state: EditorState): TableBlockRange[] {
  const ranges: TableBlockRange[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table')
        return

      const to = clampTableEnd(state, node.from, node.to)
      const source = state.sliceDoc(node.from, to)
      if (!parseMarkdownTable(source))
        return

      ranges.push({ from: node.from, to })
    },
  })

  return ranges
}

function clampTableEnd(state: EditorState, from: number, to: number): number {
  const text = state.sliceDoc(from, to)
  let offset = 0
  let end = from

  for (const line of text.split('\n')) {
    if (line.includes('|'))
      end = from + offset + line.length
    else break

    offset += line.length + 1
  }

  return end
}

export function findTableNavigationTarget(
  state: EditorState,
  head: number,
  direction: 'up' | 'down',
): number | null {
  const target = findTableNavigationTargetWithIndex(state, head, direction)
  return target?.pos ?? null
}

function findTableNavigationTargetWithIndex(
  state: EditorState,
  head: number,
  direction: 'up' | 'down',
): { index: number, pos: number } | null {
  const currentLineNumber = state.doc.lineAt(head).number
  const blocks = getTableBlockRanges(state)

  if (direction === 'down') {
    for (const [index, block] of blocks.entries()) {
      const blockStartLineNumber = state.doc.lineAt(block.from).number
      if (blockStartLineNumber <= currentLineNumber)
        continue

      if (blockStartLineNumber !== currentLineNumber + 1)
        return null

      return { index, pos: block.from }
    }

    return null
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    const blockEndLineNumber = state.doc.lineAt(
      Math.max(block.to - 1, block.from),
    ).number

    if (blockEndLineNumber >= currentLineNumber)
      continue

    if (blockEndLineNumber !== currentLineNumber - 1)
      return null

    const targetLine = state.doc.lineAt(Math.max(block.to - 1, block.from))
    return { index: i, pos: targetLine.from }
  }

  return null
}

function focusCellStart(cell: HTMLElement) {
  cell.focus()
  const range = document.createRange()
  range.selectNodeContents(cell)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getTableEntryCell(
  widget: HTMLElement,
  direction: 'up' | 'down',
): HTMLElement | null {
  if (direction === 'down')
    return widget.querySelector('thead th:first-child')

  return (
    widget.querySelector('tbody tr:last-child td:first-child')
    ?? widget.querySelector('thead th:first-child')
  )
}

function getTableWidgetAtPosition(
  view: EditorView,
  tableStart: number,
  fallbackIndex: number,
): HTMLElement | null {
  const widgets = Array.from(
    view.dom.querySelectorAll<HTMLElement>('[data-table-widget="1"]'),
  )

  for (const widget of widgets) {
    try {
      if (view.posAtDOM(widget, 0) === tableStart)
        return widget
    }
    catch {
      // CodeMirror мог пересоздать виджет между keydown и поиском DOM-узла.
    }
  }

  return widgets[fallbackIndex] ?? null
}

export function moveSelectionToAdjacentTableCell(
  view: EditorView,
  direction: 'up' | 'down',
): boolean {
  if (view.state.selection.ranges.length !== 1)
    return false

  const head = view.state.selection.main.head
  const target = findTableNavigationTargetWithIndex(
    view.state,
    head,
    direction,
  )

  if (!target)
    return false

  const widget = getTableWidgetAtPosition(view, target.pos, target.index)
  const cell = widget ? getTableEntryCell(widget, direction) : null

  if (!cell)
    return false

  focusCellStart(cell)
  cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })

  return true
}
