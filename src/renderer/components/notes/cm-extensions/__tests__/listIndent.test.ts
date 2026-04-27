import type { EditorView, KeyBinding } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import {
  EditorSelection,
  EditorState,
  type TransactionSpec,
} from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { createListIndent, listIndent } from '../listIndent'

function createState(doc: string, selection: EditorSelection, indent = '  ') {
  return EditorState.create({
    doc,
    selection,
    extensions: [
      indentUnit.of(indent),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
    ],
  })
}

function pos(doc: string, lineNumber: number, column: number) {
  const state = createState(doc, EditorSelection.single(0))
  return state.doc.line(lineNumber).from + column
}

function runBinding(
  doc: string,
  key: 'Tab' | 'Shift-Tab' | 'Enter',
  selection: EditorSelection,
  bindings: KeyBinding[] = listIndent,
) {
  let state = createState(doc, selection)
  const binding = bindings.find(binding => binding.key === key)
  const view = {
    get state() {
      return state
    },
    dispatch(...specs: TransactionSpec[]) {
      state = state.update(...specs).state
    },
  } as EditorView

  expect(binding?.run?.(view)).toBe(true)

  return {
    doc: state.doc.toString(),
    head: state.selection.main.head,
  }
}

describe('listIndent', () => {
  it('uses the configured notes indentation unit', () => {
    const doc = 'plain text'

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 5)),
      createListIndent({ indent: '    ' }),
    )

    expect(result.doc).toBe('    plain text')
  })

  it('indents the whole regular text line from any cursor position', () => {
    const doc = 'plain text'

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 5)),
    )

    expect(result.doc).toBe('  plain text')
  })

  it('removes leading indentation from regular text', () => {
    const doc = '  plain text'

    const result = runBinding(
      doc,
      'Shift-Tab',
      EditorSelection.single(pos(doc, 1, 4)),
    )

    expect(result.doc).toBe('plain text')
  })

  it('indents an empty regular text line', () => {
    const doc = ['before', '', 'after'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 2, 0)),
    )

    expect(result.doc).toBe(['before', '  ', 'after'].join('\n'))
    expect(result.head).toBe(pos(result.doc, 2, 2))
  })

  it('indents a list item together with its nested children', () => {
    const doc = ['- parent', '  - child', '- sibling'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 4)),
    )

    expect(result.doc).toBe(
      ['  - parent', '    - child', '- sibling'].join('\n'),
    )
  })

  it('does not indent unrelated indented text after a blank line', () => {
    const doc = ['before', '- item', '', '  indented text', 'after'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 2, 3)),
    )

    expect(result.doc).toBe(
      ['before', '  - item', '', '  indented text', 'after'].join('\n'),
    )
  })

  it('indents direct continuation text with its list item', () => {
    const doc = ['before', '- item', '  continuation text', 'after'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 2, 3)),
    )

    expect(result.doc).toBe(
      ['before', '  - item', '    continuation text', 'after'].join('\n'),
    )
  })

  it('indents nested list descendants without moving text after a blank boundary', () => {
    const doc = [
      '- parent',
      '  - child',
      '    - grandchild',
      '',
      '  indented text',
    ].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 4)),
    )

    expect(result.doc).toBe(
      [
        '  - parent',
        '    - child',
        '      - grandchild',
        '',
        '  indented text',
      ].join('\n'),
    )
  })

  it('does not outdent a top-level list item or its children', () => {
    const doc = ['- parent', '  - child', '- sibling'].join('\n')

    const result = runBinding(
      doc,
      'Shift-Tab',
      EditorSelection.single(pos(doc, 1, 4)),
    )

    expect(result.doc).toBe(doc)
  })

  it('indents every touched list line in a multiline selection', () => {
    const doc = ['- one', '- two', '- three'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 2), pos(doc, 2, 3)),
    )

    expect(result.doc).toBe(['  - one', '  - two', '- three'].join('\n'))
  })

  it('renumbers ordered list siblings after indent', () => {
    const doc = ['1. one', '2. two', '3. three'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 2, 3)),
    )

    expect(result.doc).toBe(['1. one', '  1. two', '2. three'].join('\n'))
  })

  it('preserves a custom ordered list start when indenting a later item', () => {
    const doc = ['4. four', '5. five', '6. six'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 3, 3)),
    )

    expect(result.doc).toBe(['4. four', '5. five', '  1. six'].join('\n'))
  })

  it('preserves a custom ordered list start when indenting a middle item', () => {
    const doc = ['4. four', '5. five', '6. six'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 2, 3)),
    )

    expect(result.doc).toBe(['4. four', '  1. five', '5. six'].join('\n'))
  })

  it('renumbers ordered list siblings after outdent', () => {
    const doc = ['1. one', '  1. two', '2. three'].join('\n')

    const result = runBinding(
      doc,
      'Shift-Tab',
      EditorSelection.single(pos(doc, 2, 5)),
    )

    expect(result.doc).toBe(['1. one', '2. two', '3. three'].join('\n'))
  })

  it('preserves a custom ordered list start when outdenting into it', () => {
    const doc = ['4. four', '  1. five', '5. six'].join('\n')

    const result = runBinding(
      doc,
      'Shift-Tab',
      EditorSelection.single(pos(doc, 2, 5)),
    )

    expect(result.doc).toBe(['4. four', '5. five', '6. six'].join('\n'))
  })

  it('lifts an empty nested unordered item to the parent level on enter', () => {
    const doc = ['- parent', '  - '].join('\n')

    const result = runBinding(
      doc,
      'Enter',
      EditorSelection.single(pos(doc, 2, 4)),
    )

    expect(result.doc).toBe(['- parent', '- '].join('\n'))
    expect(result.head).toBe(pos(result.doc, 2, 2))
  })

  it('lifts an empty nested ordered item to the parent level on enter', () => {
    const doc = ['4. parent', '  1. ', '5. next'].join('\n')

    const result = runBinding(
      doc,
      'Enter',
      EditorSelection.single(pos(doc, 2, 5)),
    )

    expect(result.doc).toBe(['4. parent', '5. ', '6. next'].join('\n'))
    expect(result.head).toBe(pos(result.doc, 2, 3))
  })

  it('exits a top-level empty list item on enter', () => {
    const doc = ['- parent', '- '].join('\n')

    const result = runBinding(
      doc,
      'Enter',
      EditorSelection.single(pos(doc, 2, 2)),
    )

    expect(result.doc).toBe(['- parent', ''].join('\n'))
    expect(result.head).toBe(pos(result.doc, 2, 0))
  })

  it('inserts indentation at the cursor inside fenced code', () => {
    const doc = ['```', '- code', '```'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 2, 2)),
    )

    expect(result.doc).toBe(['```', '-   code', '```'].join('\n'))
  })

  it('moves to the next table cell', () => {
    const doc = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 2)),
    )

    expect(result.doc).toBe(doc)
    expect(result.head).toBe(pos(doc, 1, 6))
  })

  it('moves to the previous table cell', () => {
    const doc = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n')

    const result = runBinding(
      doc,
      'Shift-Tab',
      EditorSelection.single(pos(doc, 1, 6)),
    )

    expect(result.doc).toBe(doc)
    expect(result.head).toBe(pos(doc, 1, 2))
  })

  it('moves between table cells without edge pipes', () => {
    const doc = ['A | B', '--- | ---', '1 | 2'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 1, 0)),
    )

    expect(result.doc).toBe(doc)
    expect(result.head).toBe(pos(doc, 1, 4))
  })

  it('adds a row from the last table cell', () => {
    const doc = ['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n')

    const result = runBinding(
      doc,
      'Tab',
      EditorSelection.single(pos(doc, 3, 6)),
    )

    expect(result.doc).toBe(
      ['| A | B |', '| --- | --- |', '| 1 | 2 |', '|  |  |'].join('\n'),
    )
    expect(result.head).toBe(pos(result.doc, 4, 2))
  })
})
