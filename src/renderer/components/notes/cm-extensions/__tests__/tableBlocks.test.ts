import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorSelection, EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it, vi } from 'vitest'
import {
  createTableBlocks,
  isProtectedTableBoundaryDeletePosition,
  isProtectedTableBoundaryLine,
} from '../tableBlocks'

vi.mock('@/electron', () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

function createState(doc: string, lineNumber: number, column = 0) {
  const baseState = EditorState.create({
    doc,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
    ],
  })

  return EditorState.create({
    doc,
    selection: EditorSelection.single(
      baseState.doc.line(lineNumber).from + column,
    ),
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
    ],
  })
}

function createEditableTableState(doc: string, lineNumber: number, column = 0) {
  const baseState = createState(doc, lineNumber, column)

  return EditorState.create({
    doc,
    selection: baseState.selection,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
      createTableBlocks({ editable: true }),
    ],
  })
}

describe('tableBlocks', () => {
  it('protects an empty line directly before a table', () => {
    const state = createState(
      ['', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'),
      1,
    )

    expect(isProtectedTableBoundaryLine(state)).toBe(true)
  })

  it('does not protect regular empty lines', () => {
    const state = createState(['before', '', 'after'].join('\n'), 2)

    expect(isProtectedTableBoundaryLine(state)).toBe(false)
  })

  it('does not protect non-empty lines before a table', () => {
    const state = createState(
      ['before', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'),
      1,
    )

    expect(isProtectedTableBoundaryLine(state)).toBe(false)
  })

  it('protects delete at the end of the line before an empty table boundary', () => {
    const doc = ['before', '', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join(
      '\n',
    )

    const state = createState(doc, 1, 'before'.length)

    expect(isProtectedTableBoundaryLine(state)).toBe(false)
    expect(isProtectedTableBoundaryDeletePosition(state)).toBe(true)
  })

  it('keeps an empty boundary line when typing before a table', () => {
    const doc = ['before', '', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join(
      '\n',
    )
    const state = createEditableTableState(doc, 2)

    const next = state.update({
      changes: { from: state.selection.main.head, insert: 'text' },
      userEvent: 'input.type',
    }).state

    expect(next.doc.toString()).toBe(
      ['before', 'text', '', '| A | B |', '| --- | --- |', '| 1 | 2 |'].join(
        '\n',
      ),
    )
    expect(next.selection.main.head).toBe('before\ntext'.length)
  })
})
