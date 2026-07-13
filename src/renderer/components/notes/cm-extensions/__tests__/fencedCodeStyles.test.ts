import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import {
  buildFencedCodeLineStyle,
  isStandaloneFencedCode,
} from '../fencedCodeStyles'

function getFencedCodeNodes(doc: string) {
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
  const nodes: Array<{ name: string, from: number, to: number }> = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FencedCode')
        nodes.push({ name: node.name, from: node.from, to: node.to })
    },
  })

  return { state, nodes }
}

describe('isStandaloneFencedCode', () => {
  it('detects the trailing standalone fence from a damaged opening marker', () => {
    const { state, nodes } = getFencedCodeNodes(
      [
        '``',
        'grep -h \'"event":"observability_evidence"\' /root/.pm2/logs/Api-out*.log | tail -n 1',
        '```',
      ].join('\n'),
    )

    expect(nodes).toHaveLength(1)
    expect(isStandaloneFencedCode(state, nodes[0])).toBe(true)
  })

  it('keeps a valid fenced block', () => {
    const { state, nodes } = getFencedCodeNodes(
      ['```', 'command', '```'].join('\n'),
    )

    expect(nodes).toHaveLength(1)
    expect(isStandaloneFencedCode(state, nodes[0])).toBe(false)
  })

  it('keeps a multiline unclosed fenced block', () => {
    const { state, nodes } = getFencedCodeNodes(['```', 'command'].join('\n'))

    expect(nodes).toHaveLength(1)
    expect(isStandaloneFencedCode(state, nodes[0])).toBe(false)
  })
})

describe('buildFencedCodeLineStyle', () => {
  it('does not use margins in line decorations', () => {
    const firstLine = buildFencedCodeLineStyle(3, 3, 6)
    const lastLine = buildFencedCodeLineStyle(6, 3, 6)

    expect(firstLine).not.toContain('margin-top')
    expect(lastLine).not.toContain('margin-bottom')
  })

  it('keeps top and bottom chrome for fenced block container', () => {
    const firstLine = buildFencedCodeLineStyle(3, 3, 6)
    const middleLine = buildFencedCodeLineStyle(4, 3, 6)
    const lastLine = buildFencedCodeLineStyle(6, 3, 6)

    expect(firstLine).toContain('border-top:1px solid var(--border)')
    expect(firstLine).toContain('border-top-left-radius:8px')
    expect(firstLine).toContain('padding-top:10px')

    expect(lastLine).toContain('border-bottom:1px solid var(--border)')
    expect(lastLine).toContain('border-bottom-right-radius:8px')
    expect(lastLine).toContain('padding-bottom:10px')

    expect(middleLine).not.toContain('border-top')
    expect(middleLine).not.toContain('border-bottom')
  })
})
