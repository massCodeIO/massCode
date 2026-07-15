import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorSelection, EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it, vi } from 'vitest'
import {
  canReuseTableWidgetDom,
  createTableBlocks,
  getTableLayoutStyles,
  isProtectedTableBoundaryDeletePosition,
  isProtectedTableBoundaryLine,
} from '../tableBlocks'
import { tableCellLineWrappingStyles } from '../tableCellEditor'

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
  it('reuses table widget DOM only when wrapping mode is unchanged', () => {
    expect(canReuseTableWidgetDom('1', true)).toBe(true)
    expect(canReuseTableWidgetDom('0', false)).toBe(true)
    expect(canReuseTableWidgetDom('1', false)).toBe(false)
    expect(canReuseTableWidgetDom('0', true)).toBe(false)
    expect(canReuseTableWidgetDom(undefined, true)).toBe(false)
    expect(canReuseTableWidgetDom(undefined, false)).toBe(false)
  })

  it('wraps active cell editor content only at normal word boundaries', () => {
    expect(tableCellLineWrappingStyles).toEqual({
      overflowWrap: 'normal',
      wordBreak: 'normal',
      whiteSpace: 'pre-wrap',
    })
  })

  it('keeps max-content layout when table wrapping is disabled', () => {
    const styles = getTableLayoutStyles(false)

    expect(styles.scroll).toEqual({ overflowX: 'auto' })
    expect(styles.table).toEqual({
      width: 'max-content',
      minWidth: 'max-content',
    })
    expect(styles.cell).toEqual({})
  })

  it('uses natural capped width and wraps cell content when enabled', () => {
    const styles = getTableLayoutStyles(true)

    expect(styles.scroll).toMatchObject({
      overflowX: 'auto',
      width: 'fit-content',
      maxWidth: '100%',
    })
    expect(styles.overlay).toEqual({
      width: 'fit-content',
      minWidth: 'min-content',
      maxWidth: '100%',
      boxSizing: 'border-box',
    })
    expect(styles.frame).toMatchObject({
      width: 'fit-content',
      minWidth: 'min-content',
      maxWidth: '100%',
    })
    expect(styles.table).toEqual({
      width: 'fit-content',
      minWidth: 'min-content',
      maxWidth: '100%',
    })
    expect(styles.cell).toEqual({
      overflowWrap: 'normal',
      wordBreak: 'normal',
      whiteSpace: 'normal',
    })
  })

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
