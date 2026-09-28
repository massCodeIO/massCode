import type { IGrammar } from 'monaco-textmate'
import { codeHighlighter } from '@/components/cm-extensions/codeHighlight'
import { StreamLanguage, StringStream } from '@codemirror/language'
import { highlightTree } from '@lezer/highlight'
import { describe, expect, it, vi } from 'vitest'
import { createTextMateParser } from '../textmate'

// Exercise the adapter separately from language grammar details.
vi.mock('onigasm', () => ({ loadWASM: vi.fn() }))
describe('textMate stream state', () => {
  it('copies queued tokens independently and advances multiline state through empty lines', () => {
    const grammar = {
      tokenizeLine: vi.fn((line: string, stack: { depth: number } | null) => ({
        ruleStack: { depth: (stack?.depth ?? 0) + 1 },
        tokens: [
          {
            startIndex: 0,
            endIndex: line.length + 1,
            scopes: ['comment.block'],
          },
        ],
      })),
    } as unknown as IGrammar
    const parser = createTextMateParser(grammar)
    const first = parser.startState!(4)
    const second = parser.startState!(4)
    const stream = new StringStream('comment', 4, 2)
    expect(parser.token(stream, first)).toBe('tm-comment')
    expect(stream.pos).toBe(7)
    const copied = parser.copyState!(first)
    copied.tokens.pop()
    expect(first.tokens).toHaveLength(1)
    parser.blankLine!(first, 4)
    expect(grammar.tokenizeLine).toHaveBeenLastCalledWith('', copied.stack)
    expect(first.stack).not.toBe(copied.stack)
    expect(second.stack).toBeNull()
    expect(second.tokens).toEqual([])
  })
  it('always advances for malformed zero-width tokens', () => {
    const grammar = {
      tokenizeLine: () => ({
        ruleStack: null,
        tokens: [{ startIndex: 0, endIndex: 0, scopes: [] }],
      }),
    } as unknown as IGrammar
    const parser = createTextMateParser(grammar)
    const stream = new StringStream('x', 4, 2)
    parser.token(stream, parser.startState!(4))
    expect(stream.eol()).toBe(true)
  })
})

function highlightedClasses(scopes: string[]) {
  const grammar = {
    tokenizeLine: () => ({
      ruleStack: null,
      tokens: [{ startIndex: 0, endIndex: 1, scopes }],
    }),
  } as unknown as IGrammar
  const parser = StreamLanguage.define(createTextMateParser(grammar))
  const classes: string[] = []
  highlightTree(
    parser.parser.parse('x'),
    codeHighlighter,
    (_from, _to, tokenClasses) => {
      classes.push(tokenClasses)
    },
  )
  return classes
}

describe('legacy TextMate classes through the CM6 parser', () => {
  it.each([
    ['comment.block.php', 'cm-comment'],
    ['constant.other.php', 'cm-def'],
    ['constant.character.php', 'cm-def'],
    ['constant.character.escape.php', 'cm-string-2'],
    ['constant.language.boolean.php', 'cm-atom'],
    ['constant.numeric.integer.php', 'cm-number'],
    ['constant.other.email.link.markdown', 'cm-link'],
    ['constant.other.symbol.ruby', 'cm-def'],
    ['entity.name.class.php', 'cm-def'],
    ['entity.name.function.php', 'cm-def'],
    ['entity.name.tag.html', 'cm-tag'],
    ['entity.name.type.php', 'cm-type'],
    ['entity.name.type.class.php', 'cm-variable'],
    ['entity.other.attribute-name.html', 'cm-attribute'],
    ['entity.other.inherited-class.php', 'cm-def'],
    ['entity.support.function.php', 'cm-def'],
    ['keyword.control.php', 'cm-keyword'],
    ['keyword.operator.assignment.php', 'cm-operator'],
    ['keyword.other.special-method.ruby', 'cm-keyword'],
    ['punctuation.separator.php', 'cm-operator'],
    ['punctuation.definition.string.begin.php', 'cm-operator'],
    ['punctuation.definition.comment.php', 'cm-comment'],
    ['punctuation.definition.tag.begin.html', 'cm-bracket'],
    ['storage.type.php', 'cm-keyword'],
    ['string.quoted.double.php', 'cm-string'],
    ['string.regexp.js', 'cm-string-2'],
    ['support.class.php', 'cm-def'],
    ['support.class.builtin.php', 'cm-def'],
    ['support.constant.php', 'cm-variable-2'],
    ['support.function.builtin.php', 'cm-def'],
    ['support.type.php', 'cm-type'],
    ['support.variable.php', 'cm-variable-2'],
    ['support.variable.property.php', 'cm-property'],
    ['variable.other.php', 'cm-def'],
    ['variable.language.this.php', 'cm-variable-3'],
    ['variable.other.object.php', 'cm-variable'],
    ['variable.other.object.property.php', 'cm-property'],
    ['variable.other.property.php', 'cm-property'],
    ['variable.parameter.php', 'cm-def'],
  ])('maps %s to %s', (scope, expected) => {
    expect(highlightedClasses(['source.php', scope])).toEqual([expected])
  })

  it.each([
    [
      ['string.quoted.double.php', 'punctuation.definition.string.begin.php'],
      'cm-operator',
    ],
    [
      ['string.quoted.double.php', 'constant.character.escape.php'],
      'cm-string-2',
    ],
    [['string.quoted.double.php', 'variable.other.php'], 'cm-def'],
    [['comment.block.php', 'punctuation.definition.comment.php'], 'cm-comment'],
    [['entity.name.type.php', 'meta.unmapped.php'], 'cm-type'],
    [['keyword.control.php', 'markup.bold.markdown'], 'cm-keyword'],
    [['string.quoted.php', 'invalid.illegal.php'], 'cm-string'],
    [['markup.bold.markdown', 'meta.unmapped'], 'cm-strong'],
    [['markup.italic.markdown'], 'cm-em'],
    [['markup.underline.link.markdown'], 'cm-link'],
    [['markup.heading.markdown'], 'cm-header'],
  ])('preserves inner-to-outer legacy priority for %j', (scopes, expected) => {
    expect(highlightedClasses(scopes)).toEqual([expected])
  })

  it.each([
    'commentary',
    'constantine',
    'variable-like',
    'entity.other.attribute',
    'support.unknown',
    'keywordish',
    'markup.boldish',
  ])('does not match partial scope segments: %s', (scope) => {
    expect(highlightedClasses([scope])).toEqual([])
  })
})
