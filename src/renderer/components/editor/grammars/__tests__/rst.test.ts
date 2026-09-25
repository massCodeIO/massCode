import { expect, it, vi } from 'vitest'

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
it('loads real RST with supported embedded languages and optional plain scopes', async () => {
  const { loadLanguageSupport } = await import('../index')
  const pending = loadLanguageSupport('rst')
  expect(loadLanguageSupport('rst')).toBe(pending)
  const support = await pending
  expect(support).toBeTruthy()
  for (const language of [
    'python',
    'ruby',
    'yaml',
    'cmake',
    'kconfig',
    'dts',
  ]) {
    const text = `.. code-block:: ${language}\n\n   def example():\n`
    expect(support!.language.parser.parse(text).length).toBe(text.length)
  }
})

it('loads every persisted picker language without falling back to an unrelated language', async () => {
  const { languages } = await import('../languages')
  const { loadLanguageSupport } = await import('../index')
  for (const entry of languages) {
    const support = await loadLanguageSupport(entry.value)
    expect(Boolean(support), entry.value).toBe(entry.value !== 'plain_text')
  }
}, 30000)

it('uses exact native aliases and keeps template grammar semantics', async () => {
  const { loadLanguageSupport } = await import('../index')
  const { StreamLanguage } = await import('@codemirror/language')
  expect(loadLanguageSupport('js')).toBe(loadLanguageSupport('javascript'))
  expect(
    (await loadLanguageSupport('javascript'))!.language,
  ).not.toBeInstanceOf(StreamLanguage)
  expect(
    (await loadLanguageSupport('php_laravel_blade'))!.language,
  ).toBeInstanceOf(StreamLanguage)
  expect(await loadLanguageSupport('not-a-language')).toBeUndefined()
})
