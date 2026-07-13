import type { TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import {
  computeFencedCodePairInput,
  handleFencedCodePairInput,
} from '../fencedCodeInput'

function createState(
  doc: string,
  anchor: number,
  head = anchor,
  allowMultipleSelections = false,
) {
  return EditorState.create({
    doc,
    selection: EditorSelection.range(anchor, head),
    extensions: [
      EditorState.allowMultipleSelections.of(allowMultipleSelections),
      markdown({ base: markdownLanguage, extensions: GFM }),
    ],
  })
}

function applyInput(doc: string, position: number) {
  const state = createState(doc, position)
  const result = computeFencedCodePairInput(state, position, position, '`')

  expect(result).not.toBeNull()
  const transaction = state.update({
    changes: { from: position, insert: result!.insert },
    selection: { anchor: result!.cursor },
  })

  return {
    doc: transaction.state.doc.toString(),
    cursor: transaction.state.selection.main.head,
  }
}

describe('computeFencedCodePairInput', () => {
  it('creates an empty pair before existing line content', () => {
    expect(applyInput('``adasd', 2)).toEqual({
      doc: ['```', '```', 'adasd'].join('\n'),
      cursor: 3,
    })
  })

  it.each([
    ['end of document', '``'],
    ['empty line before another line', ['``', 'next'].join('\n')],
  ])('creates an empty pair at %s', (_, doc) => {
    expect(applyInput(doc, 2)).toEqual({
      doc: ['```', '```', ...doc.slice(2).split('\n').slice(1)].join('\n'),
      cursor: 3,
    })
  })

  it('leaves the cursor after the opening fence for CodeInfo', () => {
    const paired = applyInput('``', 2)
    const state = createState(paired.doc, paired.cursor)
    const withLanguage = state.update({
      changes: { from: paired.cursor, insert: 'bash' },
      selection: { anchor: paired.cursor + 4 },
    }).state

    expect(withLanguage.doc.toString()).toBe(['```bash', '```'].join('\n'))
    expect(withLanguage.selection.main.head).toBe(7)
  })

  it('does not intercept a closing fence inside FencedCode', () => {
    const doc = ['```', 'code', '``'].join('\n')
    const state = createState(doc, doc.length)

    expect(
      computeFencedCodePairInput(state, doc.length, doc.length, '`'),
    ).toBeNull()
  })

  it('ignores inline text, non-empty selections, and multi-character input', () => {
    const inline = createState('text ``', 7)
    const selection = createState('``adasd', 0, 2)
    const emptyLine = createState('``', 2)

    expect(computeFencedCodePairInput(inline, 7, 7, '`')).toBeNull()
    expect(computeFencedCodePairInput(selection, 0, 2, '`')).toBeNull()
    expect(computeFencedCodePairInput(emptyLine, 2, 2, '``')).toBeNull()
  })

  it('keeps an existing fenced block below the new empty pair', () => {
    const existing = ['```js', 'const value = 1', '```'].join('\n')

    expect(applyInput(['``', existing].join('\n'), 2)).toEqual({
      doc: ['```', '```', existing].join('\n'),
      cursor: 3,
    })
  })

  it('ignores multiple selections', () => {
    const state = createState('``\n``', 2, 2, true).update({
      selection: EditorSelection.create([
        EditorSelection.cursor(2),
        EditorSelection.cursor(5),
      ]),
    }).state

    expect(computeFencedCodePairInput(state, 2, 2, '`')).toBeNull()
  })
})

describe('handleFencedCodePairInput', () => {
  function run(userEvent: string, composing = false) {
    let state = createState('``', 2)
    let dispatchCount = 0
    const view = {
      get state() {
        return state
      },
      composing,
      dispatch(spec: TransactionSpec) {
        dispatchCount++
        state = state.update(spec).state
      },
    } as EditorView
    const insert = () =>
      state.update({
        changes: { from: 2, insert: '`' },
        userEvent,
      })

    const handled = handleFencedCodePairInput(view, 2, 2, '`', insert)

    return { handled, dispatchCount, doc: state.doc.toString() }
  }

  it('handles manual typing in one atomic dispatch', () => {
    expect(run('input.type')).toEqual({
      handled: true,
      dispatchCount: 1,
      doc: ['```', '```'].join('\n'),
    })
  })

  it('does not handle paste or IME composition', () => {
    expect(run('input.paste').handled).toBe(false)
    expect(run('input.type.compose', true).handled).toBe(false)
    expect(run('input.type.compose').handled).toBe(false)
  })
})
