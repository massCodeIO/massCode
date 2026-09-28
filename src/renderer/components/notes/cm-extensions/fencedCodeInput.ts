import type { EditorState, Transaction } from '@codemirror/state'
import type { EditorView as EditorViewType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'

type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

const FENCE = '```'

interface FencedCodePairInput {
  insert: string
  cursor: number
}

function isInsideFencedCode(state: EditorState, position: number): boolean {
  const tree = syntaxTree(state)

  for (const side of [-1, 1] as const) {
    let node: SyntaxNode | null = tree.resolveInner(position, side)

    while (node) {
      if (node.name === 'FencedCode')
        return true

      node = node.parent
    }
  }

  return false
}

export function computeFencedCodePairInput(
  state: EditorState,
  from: number,
  to: number,
  text: string,
): FencedCodePairInput | null {
  const ranges = state.selection.ranges
  if (
    text !== '`'
    || ranges.length !== 1
    || !ranges[0].empty
    || ranges[0].from !== from
    || ranges[0].to !== to
  ) {
    return null
  }

  const line = state.doc.lineAt(from)
  if (state.sliceDoc(line.from, from) !== '``')
    return null

  if (isInsideFencedCode(state, from))
    return null

  const suffix = state.sliceDoc(from, line.to)

  return {
    insert: `\`\n${FENCE}${suffix ? '\n' : ''}`,
    cursor: from + 1,
  }
}

export function handleFencedCodePairInput(
  view: EditorViewType,
  from: number,
  to: number,
  text: string,
  insert: () => Transaction,
): boolean {
  if (view.composing)
    return false

  const defaultTransaction = insert()
  if (
    !defaultTransaction.isUserEvent('input.type')
    || defaultTransaction.isUserEvent('input.type.compose')
  ) {
    return false
  }

  const result = computeFencedCodePairInput(view.state, from, to, text)
  if (!result)
    return false

  view.dispatch({
    changes: { from, to, insert: result.insert },
    selection: { anchor: result.cursor },
    scrollIntoView: true,
    userEvent: 'input.type',
  })

  return true
}

export const fencedCodePairInput = EditorView.inputHandler.of(
  handleFencedCodePairInput,
)
