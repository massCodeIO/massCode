import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

export interface MermaidBlockRange {
  from: number
  to: number
}

function isMermaidFenceLine(lineText: string): boolean {
  return lineText.trim().toLowerCase().startsWith('```mermaid')
}

function getMermaidBlockRanges(state: EditorState): MermaidBlockRange[] {
  const ranges: MermaidBlockRange[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode')
        return

      if (!isMermaidFenceLine(state.doc.lineAt(node.from).text))
        return

      ranges.push({ from: node.from, to: node.to })
    },
  })

  return ranges
}

export function findMermaidNavigationTarget(
  state: EditorState,
  head: number,
  direction: 'up' | 'down',
): number | null {
  const currentLineNumber = state.doc.lineAt(head).number
  const blocks = getMermaidBlockRanges(state)

  if (direction === 'down') {
    for (const block of blocks) {
      const blockStartLineNumber = state.doc.lineAt(block.from).number
      if (blockStartLineNumber <= currentLineNumber)
        continue

      if (blockStartLineNumber !== currentLineNumber + 1)
        return null

      return block.from
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
    return targetLine.from
  }

  return null
}

export function moveSelectionToAdjacentMermaidSource(
  view: EditorView,
  direction: 'up' | 'down',
): boolean {
  if (view.state.selection.ranges.length !== 1)
    return false

  const head = view.state.selection.main.head
  const target = findMermaidNavigationTarget(view.state, head, direction)

  if (target === null)
    return false

  const currentLine = view.state.doc.lineAt(head)
  const currentCol = head - currentLine.from
  const targetLine = view.state.doc.lineAt(target)
  const clampedCol = Math.min(currentCol, targetLine.length)

  view.dispatch({
    selection: { anchor: targetLine.from + clampedCol },
    scrollIntoView: true,
  })

  return true
}
