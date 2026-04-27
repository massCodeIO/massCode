import type { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import {
  getListContinuationLineNumbers,
  parseListPrefix,
} from '../listLineIndent'

function createViewLike(doc: string) {
  return {
    state: EditorState.create({
      doc,
      extensions: [
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          extensions: GFM,
        }),
      ],
    }),
  } as EditorView
}

function getFirstListItemRange(view: EditorView) {
  let range: { from: number, to: number } | null = null

  syntaxTree(view.state).iterate({
    enter(node) {
      if (!range && node.name === 'ListItem') {
        range = { from: node.from, to: node.to }
      }
    },
  })

  expect(range).not.toBeNull()
  return range!
}

describe('parseListPrefix', () => {
  it('matches unordered list markers', () => {
    expect(parseListPrefix('- item')?.[1]).toBe('- ')
    expect(parseListPrefix('* item')?.[1]).toBe('* ')
    expect(parseListPrefix('+ item')?.[1]).toBe('+ ')
  })

  it('matches nested unordered list markers', () => {
    expect(parseListPrefix('  - item')?.[1]).toBe('  - ')
    expect(parseListPrefix('    - item')?.[1]).toBe('    - ')
  })

  it('matches ordered list markers', () => {
    expect(parseListPrefix('1. item')?.[1]).toBe('1. ')
    expect(parseListPrefix('10. item')?.[1]).toBe('10. ')
    expect(parseListPrefix('123. item')?.[1]).toBe('123. ')
  })

  it('matches nested ordered list markers', () => {
    expect(parseListPrefix('  1. item')?.[1]).toBe('  1. ')
  })

  it('matches task markers', () => {
    const match = parseListPrefix('- [ ] task')
    expect(match?.[1]).toBe('- ')
    expect(match?.[2]).toBe('[ ]')
  })

  it('matches checked task markers', () => {
    const matchLower = parseListPrefix('- [x] done')
    expect(matchLower?.[2]).toBe('[x]')

    const matchUpper = parseListPrefix('- [X] done')
    expect(matchUpper?.[2]).toBe('[X]')
  })

  it('matches nested task markers', () => {
    const match = parseListPrefix('  - [ ] nested task')
    expect(match?.[1]).toBe('  - ')
    expect(match?.[2]).toBe('[ ]')
  })

  it('captures full prefix for task markers', () => {
    const match = parseListPrefix('- [ ] task')
    expect(match?.[0]).toBe('- [ ] ')
  })

  it('returns null for non-list lines', () => {
    expect(parseListPrefix('regular text')).toBeNull()
    expect(parseListPrefix('# heading')).toBeNull()
    expect(parseListPrefix('> quote')).toBeNull()
    expect(parseListPrefix('')).toBeNull()
  })
})

describe('getListContinuationLineNumbers', () => {
  it('stops visual list indentation at a blank line', () => {
    const doc = ['- item', '', '  existing indented text'].join('\n')
    const view = createViewLike(doc)
    const range = getFirstListItemRange(view)

    expect(getListContinuationLineNumbers(view, range.from, range.to)).toEqual(
      [],
    )
  })

  it('keeps direct indented continuation lines in the list item', () => {
    const doc = ['- item', '  continuation'].join('\n')
    const view = createViewLike(doc)
    const range = getFirstListItemRange(view)

    expect(getListContinuationLineNumbers(view, range.from, range.to)).toEqual([
      2,
    ])
  })
})
