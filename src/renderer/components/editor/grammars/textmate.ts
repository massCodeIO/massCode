import type { StreamParser } from '@codemirror/language'
import type { IGrammar, IToken, StackElement } from 'monaco-textmate'
import { textMateTokenTable } from '@/components/cm-extensions/textMateTags'
import { LanguageSupport, StreamLanguage } from '@codemirror/language'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { auxGrammars } from './auxiliary-grammars'
import { languages } from './languages'

let ready: Promise<void> | undefined
const loaders = new Map(
  languages
    .filter(item => item.scopeName && item.grammar)
    .map(item => [item.scopeName!, item.grammar!]),
)
for (const item of auxGrammars) loaders.set(item.source, item.grammar)
const optionalScopes = new Set([
  'source.cmake',
  'source.kconfig',
  'source.dts',
])
const registry = new Registry({
  async getGrammarDefinition(scopeName) {
    const loader = loaders.get(scopeName)
    if (!loader && !optionalScopes.has(scopeName))
      throw new Error(`Unknown TextMate scope: ${scopeName}`)
    let content = loader
      ? (await loader()).default
      : { scopeName, patterns: [] }
    if (scopeName === 'text.html.php.blade' || scopeName === 'source.smarty') {
      // Inline injections already belong to this grammar. Give them precedence
      // over HTML's broad embedded-template rule, and align Smarty's stale selector scope.
      content = {
        ...content,
        injections: Object.fromEntries(
          Object.entries(content.injections).map(([selector, rule]) => [
            `L:${scopeName === 'source.smarty' ? selector.replaceAll('text.html.smarty', scopeName) : selector}`,
            rule,
          ]),
        ),
      }
    }
    return { format: 'json', content }
  },
})
interface TokenState {
  stack: StackElement
  tokens: IToken[]
  index: number
}
// Longest scope prefix reproduces the original TextMate -> CM5 token walker.
// Scope segments must match exactly: `constantly` is not `constant`.
const legacyScopeTokens: Record<string, string> = {
  'comment': 'comment',
  'constant': 'def',
  'constant.character.escape': 'string-2',
  'constant.language': 'atom',
  'constant.numeric': 'number',
  'constant.other.email.link': 'link',
  'constant.other.symbol': 'def',
  'entity.name.class': 'def',
  'entity.name.function': 'def',
  'entity.name.tag': 'tag',
  'entity.name.type': 'type',
  'entity.name.type.class': 'variable',
  'entity.other.attribute-name': 'attribute',
  'entity.other.inherited-class': 'def',
  'entity.support.function': 'def',
  'keyword': 'keyword',
  'keyword.operator': 'operator',
  // The old special-method leaf was a string, so its walker kept `keyword`.
  'punctuation': 'operator',
  'punctuation.definition.comment': 'comment',
  'punctuation.definition.tag': 'bracket',
  'storage': 'keyword',
  'string': 'string',
  'string.regexp': 'string-2',
  'support.class': 'def',
  'support.constant': 'variable-2',
  'support.function': 'def',
  'support.type': 'type',
  'support.variable': 'variable-2',
  'support.variable.property': 'property',
  'variable': 'def',
  'variable.language': 'variable-3',
  'variable.other.object': 'variable',
  'variable.other.object.property': 'property',
  'variable.other.property': 'property',
  'variable.parameter': 'def',
}
function tokenStyle(scopes: string[]): string | null {
  for (let index = scopes.length - 1; index >= 0; index--) {
    const segments = scopes[index].split('.')
    while (segments.length) {
      const token = legacyScopeTokens[segments.join('.')]
      if (token)
        return `tm-${token}`
      segments.pop()
    }
  }
  // Keep newer markup support only when no legacy scope supplied a token.
  for (const scope of [...scopes].reverse()) {
    if (/^markup\.bold(?:\.|$)/.test(scope))
      return 'strong'
    if (/^markup\.italic(?:\.|$)/.test(scope))
      return 'emphasis'
    if (/^markup\.underline\.link(?:\.|$)/.test(scope))
      return 'link'
    if (/^markup\.heading(?:\.|$)/.test(scope))
      return 'heading'
    if (/^invalid(?:\.|$)/.test(scope))
      return 'invalid'
  }
  return null
}
export function createTextMateParser(
  grammar: IGrammar,
): StreamParser<TokenState> {
  return {
    tokenTable: textMateTokenTable,
    startState: () => ({ stack: null!, tokens: [], index: 0 }),
    copyState: state => ({
      stack: state.stack,
      tokens: [...state.tokens],
      index: state.index,
    }),
    blankLine(state) {
      state.stack = grammar.tokenizeLine('', state.stack).ruleStack
      state.tokens = []
      state.index = 0
    },
    token(stream, state) {
      if (stream.sol()) {
        const result = grammar.tokenizeLine(stream.string, state.stack)
        state.stack = result.ruleStack
        state.tokens = result.tokens
        state.index = 0
      }
      while (
        state.index < state.tokens.length
        && state.tokens[state.index].endIndex <= stream.pos
      ) {
        state.index++
      }
      const token = state.tokens[state.index]
      if (!token) {
        stream.skipToEnd()
        return null
      }
      if (token.startIndex > stream.pos) {
        stream.pos = Math.min(token.startIndex, stream.string.length)
        return null
      }
      stream.pos = Math.min(
        stream.string.length,
        Math.max(stream.pos + 1, token.endIndex),
      )
      return tokenStyle(token.scopes)
    },
  }
}
export async function loadTextMateLanguage(scope: string) {
  await (ready ??= loadWASM(onigasmFile))
  return new LanguageSupport(
    StreamLanguage.define(
      createTextMateParser(await registry.loadGrammar(scope)),
    ),
  )
}
