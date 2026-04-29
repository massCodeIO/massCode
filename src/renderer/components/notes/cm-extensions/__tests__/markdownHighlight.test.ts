import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { Highlight } from '../markdownHighlight'

function createState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: [GFM, Highlight],
      }),
    ],
  })
}

function findNodes(state: EditorState, name: string) {
  const result: { from: number, to: number, text: string }[] = []
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === name) {
        result.push({
          from: node.from,
          to: node.to,
          text: state.sliceDoc(node.from, node.to),
        })
      }
    },
  })
  return result
}

describe('highlight inline parser', () => {
  it('parses ==text== into a Highlight node with two HighlightMark children', () => {
    const state = createState('==hello==')
    const highlights = findNodes(state, 'Highlight')
    const marks = findNodes(state, 'HighlightMark')

    expect(highlights).toEqual([{ from: 0, to: 9, text: '==hello==' }])
    expect(marks.map(m => m.text)).toEqual(['==', '=='])
  })

  it('parses highlight inside paragraph text', () => {
    const state = createState('foo ==bar== baz')
    const highlights = findNodes(state, 'Highlight')

    expect(highlights).toEqual([{ from: 4, to: 11, text: '==bar==' }])
  })

  it('does not parse single = pair as highlight', () => {
    const state = createState('=hello=')
    expect(findNodes(state, 'Highlight')).toEqual([])
  })

  it('does not parse three or more equals as highlight', () => {
    const state = createState('===hello===')
    expect(findNodes(state, 'Highlight')).toEqual([])
  })

  it('does not parse runs of equals adjacent to delimiters', () => {
    const state = createState('====text====')
    expect(findNodes(state, 'Highlight')).toEqual([])
  })

  it('does not parse opener with whitespace immediately after', () => {
    const state = createState('a == b == c')
    expect(findNodes(state, 'Highlight')).toEqual([])
  })

  it('does not parse highlight inside inline code', () => {
    const state = createState('`==hello==`')
    expect(findNodes(state, 'Highlight')).toEqual([])
  })
})
