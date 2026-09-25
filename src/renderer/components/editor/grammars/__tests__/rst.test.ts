import { createRequire } from 'node:module'
import { expect, it, vi } from 'vitest'

// Use the actual TextMate registry without loading the browser-only CodeMirror
// adapter. WASM is the installed onigasm binary, not a tokenizer substitute.
vi.mock('codemirror-textmate', async () => {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const { Highlighter } = require('codemirror-textmate/dist/Highlighter')
  return {
    addGrammar: vi.fn(Highlighter.addGrammar),
    activateLanguage: vi.fn(Highlighter.activateLanguage),
  }
})
vi.mock('onigasm', async () => {
  const { createRequire } = await import('node:module')
  const { readFile } = await import('node:fs/promises')
  const require = createRequire(import.meta.url)
  return {
    loadWASM: async () => {
      const bytes = await readFile(require.resolve('onigasm/lib/onigasm.wasm'))
      await require('onigasm').loadWASM(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      )
    },
  }
})
it('loads real RST and preserves core and supported embedded highlighting with plain optional bodies', async () => {
  const { loadGrammars } = await import('../index')
  const { addGrammar, activateLanguage } = await import('codemirror-textmate')
  const pending = loadGrammars()
  expect(loadGrammars()).toBe(pending)
  await pending
  const require = createRequire(import.meta.url)
  const { Highlighter } = require('codemirror-textmate/dist/Highlighter')
  const grammar = await Highlighter.loadLanguage('rst')
  expect(grammar).toBeTruthy()
  const emptyScopes = ['source.cmake', 'source.kconfig', 'source.dts']
  for (const scope of emptyScopes) {
    expect(addGrammar).toHaveBeenCalledWith(scope, {
      scopeName: scope,
      patterns: [],
    })
    expect(
      vi
        .mocked(activateLanguage)
        .mock.calls.some(([registered]) => registered === scope),
    ).toBe(false)
  }
  expect(
    Math.max(...vi.mocked(addGrammar).mock.invocationCallOrder.slice(0, 3)),
  ).toBeLessThan(
    Math.min(...vi.mocked(activateLanguage).mock.invocationCallOrder),
  )
  const tokenize = (lines: string[]) => {
    let stack: unknown
    return lines.map((line) => {
      const result = grammar.tokenizeLine(line, stack)
      stack = result.ruleStack
      return result.tokens.flatMap(
        (token: { scopes: string[] }) => token.scopes,
      )
    })
  }
  expect(
    tokenize(['**Strong**'])[0].some((scope: string) => scope.includes('bold')),
  ).toBe(true)
  for (const [language, body, expected] of [
    ['python', '   def example():', 'python'],
    ['ruby', '   def example', 'ruby'],
    ['yaml', '   key: true', 'yaml'],
  ]) {
    const scopes = tokenize([`.. code-block:: ${language}`, '', body])[2]
    expect(scopes.some((scope: string) => scope.endsWith(`.${expected}`))).toBe(
      true,
    )
  }
  for (const language of ['cmake', 'kconfig', 'dts']) {
    const scopes = tokenize([
      `.. code-block:: ${language}`,
      '',
      '   unsupported body { value }',
    ])[2]
    expect(scopes).toContain('source.rst')
    expect(
      scopes.some((scope: string) =>
        /^(?:keyword|constant|entity)\./.test(scope),
      ),
    ).toBe(false)
  }
})
