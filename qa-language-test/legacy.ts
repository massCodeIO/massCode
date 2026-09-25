import type { StackElement } from 'monaco-textmate'
import { Registry } from 'monaco-textmate'
import { auxGrammars } from '../src/renderer/components/editor/grammars/auxiliary-grammars'
import { languages } from '../src/renderer/components/editor/grammars/languages'
import { loadTextMateLanguage } from '../src/renderer/components/editor/grammars/textmate'
import scopeMap from './legacy-scope-map.json'

// Frozen lookup tree from codemirror-textmate@1.1.0 dist/tmToCm.js (MIT).
// Independent of the production adapter; retain its actual longest-prefix lookup.
interface ScopeNode {
  [key: string]: ScopeNode | string
}
function scopeClass(scope: string): string | undefined {
  let node: ScopeNode | string = scopeMap
  let result: string | undefined
  for (const segment of scope.split('.')) {
    if (typeof node === 'string' || !Object.hasOwn(node, segment))
      break
    node = node[segment]!
    if (typeof node !== 'string' && typeof node.$ === 'string')
      result = node.$
  }
  return result && `cm-${result}`
}

const loaders = new Map(
  languages
    .filter(item => item.scopeName && item.grammar)
    .map(item => [item.scopeName!, item.grammar!]),
)
for (const item of auxGrammars) loaders.set(item.source, item.grammar)
const registry = new Registry({
  async getGrammarDefinition(scopeName) {
    const loader = loaders.get(scopeName)
    if (
      !loader
      && !['source.cmake', 'source.kconfig', 'source.dts'].includes(scopeName)
    ) {
      throw new Error(`Unknown legacy grammar: ${scopeName}`)
    }
    return {
      format: 'json',
      content: loader ? (await loader()).default : { scopeName, patterns: [] },
    }
  },
})

export async function legacySpans(id: string, source: string) {
  const entry = languages.find(item => item.value === id)
  if (!entry?.scopeName)
    return []
  // Initializes the shared WASM runtime, but does not supply baseline tokens/styles.
  await loadTextMateLanguage(entry.scopeName)
  const grammar = await registry.loadGrammar(entry.scopeName)
  let stack: StackElement = null!
  let offset = 0
  const spans: { from: number, to: number, classes: string, text: string }[]
    = []
  for (const line of source.split('\n')) {
    const result = grammar.tokenizeLine(line, stack)
    stack = result.ruleStack
    for (const token of result.tokens) {
      const classes = [...token.scopes].reverse().map(scopeClass).find(Boolean)
      const from = offset + token.startIndex
      const to = offset + Math.min(line.length, token.endIndex)
      if (classes && to > from)
        spans.push({ from, to, classes, text: source.slice(from, to) })
    }
    offset += line.length + 1
  }
  return spans
}
