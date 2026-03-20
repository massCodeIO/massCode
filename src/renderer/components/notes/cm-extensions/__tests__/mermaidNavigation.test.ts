import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { findMermaidNavigationTarget } from '../mermaidNavigation'

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

describe('findMermaidNavigationTarget', () => {
  it('moves down into mermaid block when cursor is on blank line before block', () => {
    const state = createState(
      [
        'before',
        '',
        '```mermaid',
        'flowchart LR',
        'A-->B',
        '```',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(2).from

    const target = findMermaidNavigationTarget(state, head, 'down')

    expect(target).not.toBeNull()
    expect(target).toBe(state.doc.line(3).from + 1)
  })

  it('moves up into mermaid block when cursor is on blank line after block', () => {
    const state = createState(
      [
        'before',
        '```mermaid',
        'flowchart LR',
        'A-->B',
        '```',
        '',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(6).from

    const target = findMermaidNavigationTarget(state, head, 'up')

    expect(target).not.toBeNull()
    expect(target).toBe(state.doc.line(5).to - 1)
  })

  it('does not jump from non-empty line even when only blank lines are between cursor and block', () => {
    const state = createState(
      [
        'before',
        'middle',
        '',
        '```mermaid',
        'flowchart LR',
        'A-->B',
        '```',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(2).to

    const target = findMermaidNavigationTarget(state, head, 'down')

    expect(target).toBeNull()
  })

  it('does not jump from separator line to mermaid block when moving up', () => {
    const state = createState(
      [
        '```mermaid',
        'flowchart LR',
        'A-->B',
        '```',
        '',
        '---',
        'after',
        '',
      ].join('\n'),
    )
    const head = state.doc.line(6).from + 1

    const target = findMermaidNavigationTarget(state, head, 'up')

    expect(target).toBeNull()
  })

  it('ignores non-mermaid fenced code blocks', () => {
    const state = createState(
      ['before', '```ts', 'console.log("x")', '```', 'after', ''].join('\n'),
    )
    const head = state.doc.line(1).to

    const target = findMermaidNavigationTarget(state, head, 'down')

    expect(target).toBeNull()
  })
})
