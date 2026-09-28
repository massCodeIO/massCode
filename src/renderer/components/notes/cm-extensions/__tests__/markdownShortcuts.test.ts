import type { TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { Highlight } from '../markdownHighlight'
import {
  computeInlineToggle,
  insertMarkdownLink,
  markdownShortcuts,
} from '../markdownShortcuts'

function createState(doc: string, anchor: number, head = anchor) {
  return EditorState.create({
    doc,
    selection: EditorSelection.range(anchor, head),
    extensions: [
      markdown({
        base: markdownLanguage,
        extensions: [GFM, Highlight],
      }),
    ],
  })
}

function toggle(doc: string, from: number, to: number, marker: string) {
  const state = createState(doc, from, to)
  const result = computeInlineToggle(state, state.selection.main, marker)
  const next = state.update({
    changes: result.changes,
    selection: EditorSelection.range(
      result.selection.anchor,
      result.selection.head ?? result.selection.anchor,
    ),
  }).state

  return {
    doc: next.doc.toString(),
    from: next.selection.main.from,
    to: next.selection.main.to,
  }
}

describe('computeInlineToggle', () => {
  it('wraps selected text with bold markers', () => {
    expect(toggle('hello world', 0, 5, '**')).toEqual({
      doc: '**hello** world',
      from: 2,
      to: 7,
    })
  })

  it('unwraps when the selection is the formatted content', () => {
    expect(toggle('**hello** world', 2, 7, '**')).toEqual({
      doc: 'hello world',
      from: 0,
      to: 5,
    })
  })

  it('unwraps when the selection includes the markers', () => {
    expect(toggle('**hello** world', 0, 9, '**')).toEqual({
      doc: 'hello world',
      from: 0,
      to: 5,
    })
  })

  it('unwraps from a cursor inside the formatted span', () => {
    expect(toggle('**hello** world', 4, 4, '**')).toEqual({
      doc: 'hello world',
      from: 2,
      to: 2,
    })
  })

  it('formats the whole word around an empty selection', () => {
    expect(toggle('hello world', 3, 3, '**')).toEqual({
      doc: '**hello** world',
      from: 5,
      to: 5,
    })
  })

  it('inserts a marker pair when there is no word at the cursor', () => {
    expect(toggle('hello ', 6, 6, '*')).toEqual({
      doc: 'hello **',
      from: 7,
      to: 7,
    })
  })

  it('does not strip bold markers when toggling italic inside bold', () => {
    expect(toggle('**bold**', 2, 6, '*')).toEqual({
      doc: '***bold***',
      from: 3,
      to: 7,
    })
  })

  it('unwraps italic without touching surrounding text', () => {
    expect(toggle('say *hello* world', 7, 7, '*')).toEqual({
      doc: 'say hello world',
      from: 6,
      to: 6,
    })
  })

  it('unwraps highlight from a cursor inside', () => {
    expect(toggle('==hello==', 4, 4, '==')).toEqual({
      doc: 'hello',
      from: 2,
      to: 2,
    })
  })

  it('unwraps inline code from a cursor inside', () => {
    expect(toggle('`code`', 3, 3, '`')).toEqual({
      doc: 'code',
      from: 2,
      to: 2,
    })
  })

  it('unwraps strikethrough when the selection is the content', () => {
    expect(toggle('~~gone~~', 2, 6, '~~')).toEqual({
      doc: 'gone',
      from: 0,
      to: 4,
    })
  })
})

function runCommand(
  doc: string,
  command: (view: EditorView) => boolean,
  selection:
    | EditorSelection
    | { anchor: number, head?: number } = EditorSelection.single(0),
) {
  let state = EditorState.create({ doc, selection })
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

describe('insertMarkdownLink', () => {
  it('wraps the selection and places the cursor in the url parens', () => {
    expect(
      runCommand('hello', insertMarkdownLink, EditorSelection.range(0, 5)),
    ).toEqual({
      doc: '[hello]()',
      head: 8,
    })
  })

  it('inserts an empty link and places the cursor in the brackets', () => {
    expect(runCommand('', insertMarkdownLink)).toEqual({
      doc: '[]()',
      head: 1,
    })
  })

  it('wraps the word around an empty selection', () => {
    expect(
      runCommand('hello world', insertMarkdownLink, EditorSelection.single(2)),
    ).toEqual({
      doc: '[hello]() world',
      head: 8,
    })
  })
})

describe('markdownShortcuts', () => {
  it('registers the formatting shortcuts', () => {
    expect(markdownShortcuts.map(binding => binding.key)).toEqual([
      'Mod-b',
      'Mod-i',
      'Mod-e',
      'Mod-k',
      'Mod-Shift-s',
      'Mod-Shift-h',
    ])
  })
})
