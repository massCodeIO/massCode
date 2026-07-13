import type { SyntaxNode } from '@lezer/common'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import {
  canShowMarkup,
  shouldHideUrlNodeInMarkup,
  shouldKeepStandaloneFencedCodeMarkup,
} from '../hideMarkup'

function getFencedMarkupNodes(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
    ],
  })
  const nodes: Array<{ name: string, parent: SyntaxNode }> = []

  syntaxTree(state).iterate({
    enter(node) {
      const parent = node.node.parent
      if (
        (node.name === 'CodeMark' || node.name === 'CodeInfo')
        && parent?.name === 'FencedCode'
      ) {
        nodes.push({ name: node.name, parent })
      }
    },
  })

  return nodes
}

describe('standalone fenced code markup visibility', () => {
  it('keeps CodeMark and CodeInfo for a standalone fence', () => {
    const nodes = getFencedMarkupNodes('```bash\n')

    expect(
      nodes.map(node => [
        node.name,
        shouldKeepStandaloneFencedCodeMarkup(node.name, node.parent),
      ]),
    ).toEqual([
      ['CodeMark', true],
      ['CodeInfo', true],
    ])
  })

  it('does not keep CodeMark or CodeInfo for a regular fenced block', () => {
    const nodes = getFencedMarkupNodes(['```bash', 'code', '```'].join('\n'))

    expect(nodes.map(node => node.name)).toEqual([
      'CodeMark',
      'CodeInfo',
      'CodeMark',
    ])
    expect(
      nodes.map(node =>
        shouldKeepStandaloneFencedCodeMarkup(node.name, node.parent),
      ),
    ).toEqual([false, false, false])
  })
})

describe('hideMarkup url visibility', () => {
  it('hides URL node inside markdown link', () => {
    expect(shouldHideUrlNodeInMarkup('URL', 'Link')).toBe(true)
  })

  it('hides URL node inside markdown image', () => {
    expect(shouldHideUrlNodeInMarkup('URL', 'Image')).toBe(true)
  })

  it('does not hide plain URL node outside markdown link/image', () => {
    expect(shouldHideUrlNodeInMarkup('URL', 'Paragraph')).toBe(false)
    expect(shouldHideUrlNodeInMarkup('URL', null)).toBe(false)
  })

  it('does not affect non-url nodes', () => {
    expect(shouldHideUrlNodeInMarkup('LinkMark', 'Link')).toBe(false)
  })
})

describe('canShowMarkup', () => {
  it('returns false when editor is blurred', () => {
    expect(canShowMarkup(false, false)).toBe(false)
  })

  it('returns false when alwaysHide is enabled', () => {
    expect(canShowMarkup(true, true)).toBe(false)
    expect(canShowMarkup(true, false)).toBe(false)
  })

  it('returns true only when editor is focused and alwaysHide is off', () => {
    expect(canShowMarkup(false, true)).toBe(true)
  })
})
