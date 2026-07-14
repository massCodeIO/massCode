import type { Extension, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import {
  clearInlineFormatting,
  insertTable,
  normalizeLineBreaks,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
} from '../editorCommands'
import { Highlight } from '../markdownHighlight'

function runCommand(
  doc: string,
  command: (view: EditorView) => void,
  selection:
    | EditorSelection
    | { anchor: number, head?: number } = EditorSelection.single(0),
  extensions: Extension = [],
) {
  let state = EditorState.create({ doc, selection, extensions })
  const view = {
    get state() {
      return state
    },
    dispatch(...specs: TransactionSpec[]) {
      state = state.update(...specs).state
    },
    focus() {},
  } as EditorView

  command(view)

  return {
    doc: state.doc.toString(),
    head: state.selection.main.head,
  }
}

describe('editorCommands lists', () => {
  it('adds a bullet marker on an empty line', () => {
    expect(runCommand('', toggleBulletList)).toEqual({
      doc: '- ',
      head: 2,
    })
  })

  it('adds an ordered marker on an empty line', () => {
    expect(runCommand('', toggleOrderedList)).toEqual({
      doc: '1. ',
      head: 3,
    })
  })

  it('adds a task marker on an empty line', () => {
    expect(runCommand('', toggleTaskList)).toEqual({
      doc: '- [ ] ',
      head: 6,
    })
  })

  it('keeps blank lines inside multi-line selections untouched', () => {
    const doc = ['first', '', 'second'].join('\n')
    const result = runCommand(
      doc,
      toggleBulletList,
      EditorSelection.range(0, doc.length),
    )

    expect(result.doc).toBe(['- first', '', '- second'].join('\n'))
  })
})

function runNormalizeLineBreaks(
  doc: string,
  selection: EditorSelection | { anchor: number, head?: number },
) {
  let state = EditorState.create({ doc, selection })
  let dispatchCount = 0
  let focusCount = 0
  const view = {
    get state() {
      return state
    },
    dispatch(...specs: TransactionSpec[]) {
      dispatchCount += 1
      state = state.update(...specs).state
    },
    focus() {
      focusCount += 1
    },
  } as EditorView

  normalizeLineBreaks(view)

  return {
    anchor: state.selection.main.anchor,
    dispatchCount,
    doc: state.doc.toString(),
    focusCount,
    head: state.selection.main.head,
  }
}

describe('editorCommands normalizeLineBreaks', () => {
  it('normalizes only the selected text and keeps the outside untouched', () => {
    const doc = 'before\n  wrapped\n  text\nafter'
    const from = doc.indexOf('  wrapped')
    const to = doc.indexOf('\nafter')

    expect(
      runNormalizeLineBreaks(doc, EditorSelection.range(from, to)),
    ).toEqual({
      anchor: from,
      dispatchCount: 1,
      doc: 'before\nwrapped text\nafter',
      focusCount: 1,
      head: from + 'wrapped text'.length,
    })
  })

  it('preserves a backward selection direction', () => {
    const doc = 'before\n  wrapped\n  text\nafter'
    const from = doc.indexOf('  wrapped')
    const to = doc.indexOf('\nafter')
    const replacementEnd = from + 'wrapped text'.length

    expect(
      runNormalizeLineBreaks(doc, EditorSelection.range(to, from)),
    ).toEqual({
      anchor: replacementEnd,
      dispatchCount: 1,
      doc: 'before\nwrapped text\nafter',
      focusCount: 1,
      head: from,
    })
  })

  it('normalizes the whole document and maps the cursor at a line boundary', () => {
    expect(runNormalizeLineBreaks('first\nsecond', { anchor: 6 })).toEqual({
      anchor: 6,
      dispatchCount: 1,
      doc: 'first second',
      focusCount: 1,
      head: 6,
    })
  })

  it('only focuses and preserves selection when text is unchanged', () => {
    expect(
      runNormalizeLineBreaks(
        'already normalized',
        EditorSelection.range(0, 'already normalized'.length),
      ),
    ).toEqual({
      anchor: 0,
      dispatchCount: 0,
      doc: 'already normalized',
      focusCount: 1,
      head: 'already normalized'.length,
    })
  })
})

const markdownExtension = markdown({
  base: markdownLanguage,
  extensions: [GFM, Highlight],
})

function runClearFormatting(doc: string, from: number, to: number) {
  return runCommand(
    doc,
    clearInlineFormatting,
    EditorSelection.range(from, to),
    markdownExtension,
  ).doc
}

describe('editorCommands clearInlineFormatting', () => {
  it('removes inline formatting marks in the selection', () => {
    const doc = '**bold** and *italic* and ~~gone~~ and ==mark== and `code`'

    expect(runClearFormatting(doc, 0, doc.length)).toBe(
      'bold and italic and gone and mark and code',
    )
  })

  it('keeps legitimate characters that only look like markers', () => {
    const doc = 'snake_case and a * b and file_name.txt'

    expect(runClearFormatting(doc, 0, doc.length)).toBe(doc)
  })

  it('keeps fenced code block fences', () => {
    const doc = '```\nconst a = 1\n```'

    expect(runClearFormatting(doc, 0, doc.length)).toBe(doc)
  })

  it('only removes marks fully inside the selection', () => {
    const doc = '**bold** text'

    expect(runClearFormatting(doc, 2, doc.length)).toBe('**bold text')
  })
})

describe('editorCommands table', () => {
  it('adds an empty boundary line before an inserted table', () => {
    const result = runCommand('', insertTable)

    expect(result.doc.split('\n').slice(0, 2)).toEqual([
      '',
      '| Column | Column |',
    ])
  })
})
