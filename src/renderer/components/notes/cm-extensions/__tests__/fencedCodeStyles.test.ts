import type { SyntaxNode } from '@lezer/common'
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
  const nodes: SyntaxNode[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FencedCode')
        nodes.push(node.node)
    },
  })

  return nodes
}

describe('isStandaloneFencedCode', () => {
  it.each(['```', '```\n', '```bash', '```bash\n'])(
    'detects a standalone fence in %j',
    (doc) => {
      const nodes = getFencedCodeNodes(doc)

      expect(nodes).toHaveLength(1)
      expect(isStandaloneFencedCode(nodes[0])).toBe(true)
    },
  )

  it.each([
    ['multiline unclosed fence', ['```', 'code'].join('\n')],
    ['multiline unclosed fence with info', ['```bash', 'code'].join('\n')],
    ['empty multiline unclosed fence', ['```', '', ''].join('\n')],
    ['valid empty fenced block', ['```', '```'].join('\n')],
  ])('keeps a %s', (_, doc) => {
    const nodes = getFencedCodeNodes(doc)

    expect(nodes).toHaveLength(1)
    expect(isStandaloneFencedCode(nodes[0])).toBe(false)
  })

  it('distinguishes a valid block from a trailing fence with a final LF', () => {
    const nodes = getFencedCodeNodes(
      [
        '```',
        'adasd',
        'adasdasdas',
        '',
        '```',
        'grep -h \'"event":"observability_evidence"\' /root/.pm2/logs/Api-out*.log | tail -n 1',
        '```',
        '',
      ].join('\n'),
    )

    expect(nodes).toHaveLength(2)
    expect(nodes.map(isStandaloneFencedCode)).toEqual([false, true])
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
