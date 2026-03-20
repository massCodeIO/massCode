import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

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

      ranges.push({ from: node.from, to: node.to })
    },
  })

  return ranges
}

function hasOnlyBlankLinesBetween(
  state: EditorState,
  fromLine: number,
  toLine: number,
): boolean {
  for (let lineNumber = fromLine + 1; lineNumber < toLine; lineNumber++) {
    if (state.doc.line(lineNumber).text.trim().length > 0)
      return false
  }

  return true
}

function isLineBlank(state: EditorState, lineNumber: number): boolean {
  return state.doc.line(lineNumber).text.trim().length === 0
}

export function findTableNavigationTarget(
  state: EditorState,
  head: number,
  direction: 'up' | 'down',
): number | null {
  const currentLineNumber = state.doc.lineAt(head).number
  if (!isLineBlank(state, currentLineNumber))
    return null

  const blocks = getTableBlockRanges(state)

  if (direction === 'down') {
    for (const block of blocks) {
      const blockStartLineNumber = state.doc.lineAt(block.from).number
      if (blockStartLineNumber <= currentLineNumber)
        continue

      if (
        hasOnlyBlankLinesBetween(state, currentLineNumber, blockStartLineNumber)
      ) {
        return Math.min(block.from + 1, block.to)
      }

      return null
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

    if (hasOnlyBlankLinesBetween(state, blockEndLineNumber, currentLineNumber))
      return Math.max(block.to - 1, block.from)

    return null
  }

  return null
}

export function moveSelectionToAdjacentTableSource(
  view: EditorView,
  direction: 'up' | 'down',
): boolean {
  if (view.state.selection.ranges.length !== 1)
    return false

  const target = findTableNavigationTarget(
    view.state,
    view.state.selection.main.head,
    direction,
  )

  if (target === null)
    return false

  view.dispatch({
    selection: { anchor: target },
    scrollIntoView: true,
  })

  return true
}
