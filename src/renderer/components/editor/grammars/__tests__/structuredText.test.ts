import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { loadWASM } from 'onigasm'
import { beforeAll, describe, expect, it } from 'vitest'
import { languages, oldLanguageMap } from '../languages'
import definition from '../textmate/structuredText.tmLanguage.json'

const require = createRequire(import.meta.url)
// Exercise the same TextMate engine used by codemirror-textmate.
const { Registry } = createRequire(require.resolve('codemirror-textmate'))(
  'monaco-textmate',
)
const registry = new Registry({
  getGrammarDefinition: async () => ({ format: 'json', content: definition }),
})
let grammar: Awaited<ReturnType<typeof registry.loadGrammar>>

interface Token {
  startIndex: number
  endIndex: number
  scopes: string[]
}

beforeAll(async () => {
  const wasm = readFileSync(require.resolve('onigasm/lib/onigasm.wasm'))
  await loadWASM(Uint8Array.from(wasm).buffer)
  grammar = await registry.loadGrammar('source.st')
})

function tokensWithScope(source: string, scope: string): string[] {
  return grammar
    .tokenizeLine(source)
    .tokens
    .filter((token: Token) => token.scopes.includes(scope))
    .map((token: Token) => source.slice(token.startIndex, token.endIndex))
}

describe('structured Text', () => {
  it('loads the grammar through the language selector and preserves the legacy ID', async () => {
    const language = languages.find(language => language.value === 'st')!
    expect(language.name).toBe('Structured Text (IEC 61131-3)')
    expect(language.scopeName).toBe(definition.scopeName)
    expect((await language.grammar!()).default).toEqual(definition)
    expect(oldLanguageMap.st).toBe('st')
  })

  it('highlights declarations, types and control flow case-insensitively', () => {
    expect(
      tokensWithScope(
        'program Main var_input end_var end_program',
        'keyword.declaration.st',
      ),
    ).toEqual(['program', 'var_input', 'end_var', 'end_program'])
    expect(
      tokensWithScope('BOOL Int dInT TIME WSTRING', 'storage.type.st'),
    ).toEqual(['BOOL', 'Int', 'dInT', 'TIME', 'WSTRING'])
    expect(
      tokensWithScope(
        'if x then elsif y THEN else END_IF',
        'keyword.control.st',
      ),
    ).toEqual(['if', 'then', 'elsif', 'THEN', 'else', 'END_IF'])
    expect(
      tokensWithScope('ifEnabled END_IF_count myPROGRAM', 'keyword.control.st'),
    ).toEqual([])
  })

  it.each([
    '16#FF',
    '2#1010_0011',
    '8#77',
    'WORD#16#FF',
    'INT#-42',
    'REAL#1.5E-3',
    '1_000',
    '1.0e+12',
    'REAL#55.',
  ])('highlights the complete numeric literal %s', (literal) => {
    expect(
      tokensWithScope(`value := ${literal};`, 'constant.numeric.st'),
    ).toEqual([literal])
  })

  it.each([
    ['T#250ms', 'constant.numeric.time.st'],
    ['time#-1h_30m', 'constant.numeric.time.st'],
    ['LTIME#1us', 'constant.numeric.time.st'],
    ['D#2026-09-04', 'constant.numeric.date.st'],
    ['TOD#12:30:00.5', 'constant.numeric.date.st'],
    ['DT#2026-09-04-12:30:00', 'constant.numeric.date.st'],
    ['BOOL#TRUE', 'constant.language.boolean.st'],
    ['bool#0', 'constant.language.boolean.st'],
    ['false', 'constant.language.boolean.st'],
  ])('highlights the complete typed literal %s', (literal, scope) => {
    expect(tokensWithScope(`value := ${literal};`, scope)).toEqual([literal])
  })

  it('keeps array ranges separate from decimal numbers', () => {
    const source = 'values : ARRAY[0..10] OF INT;'
    expect(tokensWithScope(source, 'constant.numeric.st')).toEqual(['0', '10'])
    expect(tokensWithScope(source, 'punctuation.separator.st')).toContain('..')
  })

  it('highlights operators and direct PLC addresses', () => {
    expect(
      tokensWithScope(
        'x := a AND NOT b OR c MOD 2 <> 0;',
        'keyword.operator.st',
      ),
    ).toEqual([':=', 'AND', 'NOT', 'OR', 'MOD', '<>'])
    expect(
      tokensWithScope(
        'input AT %IX0.1 : BOOL; output AT %QW2 : WORD;',
        'variable.other.address.st',
      ),
    ).toEqual(['%IX0.1', '%QW2'])
  })

  it('does not parse keywords or numbers inside line comments', () => {
    const source = 'IF ready THEN // END_IF 42'
    expect(tokensWithScope(source, 'keyword.control.st')).toEqual([
      'IF',
      'THEN',
    ])
    expect(tokensWithScope(source, 'constant.numeric.st')).toEqual([])
  })

  it('keeps nested block comments across lines and resumes code afterwards', () => {
    const first = grammar.tokenizeLine('(* outer (* nested')
    const second = grammar.tokenizeLine(
      '*) IF still_comment THEN',
      first.ruleStack,
    )
    expect(
      second.tokens.every((token: Token) =>
        token.scopes.includes('comment.block.st'),
      ),
    ).toBe(true)
    const third = grammar.tokenizeLine('*) IF ready THEN', second.ruleStack)
    expect(
      third.tokens.filter((token: Token) =>
        token.scopes.includes('keyword.control.st'),
      ),
    ).toHaveLength(2)
  })

  it.each([
    ['STRING#\'Don$\'t IF // (* $41\'', 'string.quoted.single.st', ['$\'', '$41']],
    [
      'WSTRING#"Say $"IF$" $0041"',
      'string.quoted.double.st',
      ['$"', '$"', '$0041'],
    ],
  ])(
    'handles escaped quotes and comment delimiters in %s',
    (literal, scope, escapes) => {
      const source = `text := ${literal}; IF ready THEN`
      expect(tokensWithScope(source, scope).join('')).toBe(literal)
      expect(tokensWithScope(source, 'constant.character.escape.st')).toEqual(
        escapes,
      )
      expect(tokensWithScope(source, 'keyword.control.st')).toEqual([
        'IF',
        'THEN',
      ])
    },
  )
})
