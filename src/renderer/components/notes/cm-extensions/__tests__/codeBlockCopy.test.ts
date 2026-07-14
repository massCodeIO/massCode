import type { VNode } from 'vue'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, it, vi } from 'vitest'
import {
  configureCodeBlockCopyRoot,
  createCodeBlockCopyControl,
  getFencedCodeContent,
} from '../codeBlockCopy'

function getContent(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  })
  const fencedCode = syntaxTree(state).topNode.getChild('FencedCode')

  if (!fencedCode)
    throw new Error('Expected fenced code block')

  return getFencedCodeContent(state, fencedCode)
}

describe('getFencedCodeContent', () => {
  it('extracts the language token and only CodeText from a fenced block', () => {
    expect(
      getContent('~~~typescript title=example\nconst value = 1\n~~~'),
    ).toEqual({
      language: 'typescript',
      code: 'const value = 1',
    })
  })

  it('returns an empty language without including fences in copied code', () => {
    expect(getContent('~~~\nline 1\nline 2\n~~~')).toEqual({
      language: '',
      code: 'line 1\nline 2',
    })
  })

  it('supports an empty fenced block', () => {
    expect(getContent('~~~\n~~~')).toEqual({
      language: '',
      code: '',
    })
  })
})

describe('code block copy control', () => {
  it('uses the project tooltip without a native title', () => {
    const control = createCodeBlockCopyControl(
      { language: 'ts', code: 'const value = 1' },
      { label: 'Copy', copy: vi.fn() },
    )
    const slots = control.children as { default: () => VNode }
    const actionButton = slots.default()

    expect(actionButton.props.tooltip).toBe('Copy')
    expect(actionButton.props['aria-label']).toBe('Copy')
    expect(actionButton.props.title).toBeUndefined()
  })

  it('marks the widget root and control as non-selectable', () => {
    const root = {
      className: '',
      contentEditable: '',
      style: {},
    } as unknown as HTMLElement

    configureCodeBlockCopyRoot(root)

    expect(root.contentEditable).toBe('false')
    expect(root.style.userSelect).toBe('none')

    const control = createCodeBlockCopyControl(
      { language: '', code: '' },
      { label: 'Copy', copy: vi.fn() },
    )
    const slots = control.children as { default: () => VNode }
    const actionButton = slots.default()
    expect(actionButton.props.contenteditable).toBe(false)
    expect(actionButton.props.class).toContain('select-none')
    expect(actionButton.props.class).toContain('h-6')
    expect(actionButton.props.class).toContain('leading-3')
    expect(actionButton.props.class).not.toContain('cursor-pointer')
  })
})
