import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { findTableNavigationTarget } from '../tableNavigation'

function createState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
    ],
  })
}

describe('findTableNavigationTarget', () => {
  it('moves down into table block when cursor is on blank line before table', () => {
    const state = createState(
      [
        'before',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(2).from

    const target = findTableNavigationTarget(state, head, 'down')

    expect(target).not.toBeNull()
    expect(target).toBe(state.doc.line(3).from + 1)
  })

  it('moves up into table block when cursor is on blank line after table', () => {
    const state = createState(
      [
        'before',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(5).from

    const target = findTableNavigationTarget(state, head, 'up')

    expect(target).not.toBeNull()
    expect(target).toBe(state.doc.line(4).to - 1)
  })

  it('does not jump from non-empty line even when only blank lines are between cursor and table', () => {
    const state = createState(
      [
        'before',
        'middle',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(2).to

    const target = findTableNavigationTarget(state, head, 'down')

    expect(target).toBeNull()
  })

  it('does not jump from separator line to table when moving up', () => {
    const state = createState(
      [
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        '---',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(5).from + 1

    const target = findTableNavigationTarget(state, head, 'up')

    expect(target).toBeNull()
  })
})
