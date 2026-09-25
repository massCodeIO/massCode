import { highlightCode } from '@/components/ai/highlight'
import { codeHighlighter } from '@/components/cm-extensions/codeHighlight'
import { highlightTree } from '@lezer/highlight'
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

it.each([
  ['php_laravel_blade', '{{-- remark --}}\n{{ \'hello\' }}'],
  ['smarty', '{* remark *}\n{assign var=message value="hello"}'],
])('highlights local template injections for %s', async (language, code) => {
  const { loadLanguageSupport } = await import('../index')
  const support = await loadLanguageSupport(language)
  support!.language.parser.parse(code)
  const html = await highlightCode(code, language)
  expect(html).toMatch(/class="cm-comment">[^<]*remark/)
  expect(html).toMatch(/class="cm-string">[^<]*hello/)
})

it('keeps template injections out of the plain HTML grammar', async () => {
  const { loadTextMateLanguage } = await import('../textmate')
  const support = await loadTextMateLanguage('text.html.basic')
  const code = '<div>{{-- remark --}} {* remark *}</div>'
  const tokens: { text: string, classes: string }[] = []
  highlightTree(
    support.language.parser.parse(code),
    codeHighlighter,
    (from, to, classes) => {
      tokens.push({ text: code.slice(from, to), classes })
    },
  )
  expect(
    tokens.some(token => token.classes === 'cm-tag' && token.text === 'div'),
  ).toBe(true)
  expect(tokens.some(token => token.classes === 'cm-comment')).toBe(false)
  expect(tokens.some(token => token.text.includes('remark'))).toBe(false)
})
it('keeps HTML attributes highlighted alongside Blade expressions', async () => {
  const html = await highlightCode(
    '<div class="sample">{{ \'hello\' }}</div>',
    'php_laravel_blade',
  )
  expect(html).toMatch(/class="cm-attribute">class<\/span>/)
  expect(html).toMatch(/class="cm-string">sample<\/span>/)
  expect(html).toMatch(/class="cm-string">hello<\/span>/)
})

it.each([
  [
    'source.ahk',
    '; remark\nMsgBox, Hello\nmessage := "hello"',
    'hello',
    'cm-string',
  ],
  [
    'source.graphql',
    '# remark\ntype Query { hello: String }',
    'Query',
    'cm-type',
  ],
  [
    'text.html.mediawiki',
    '[https://example.com/docs Documentation]',
    'https://example.com/docs',
    'cm-link',
  ],
])(
  'tokenizes %s without endless-loop diagnostics',
  async (scope, code, expectedText, expectedClass) => {
    // Spies call through: diagnostics remain visible and are also asserted below.
    const diagnostics = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
    ]
    try {
      const { loadTextMateLanguage } = await import('../textmate')
      const support = await loadTextMateLanguage(scope)
      const tokens: { text: string, classes: string }[] = []
      highlightTree(
        support.language.parser.parse(code),
        codeHighlighter,
        (from, to, classes) => {
          tokens.push({ text: code.slice(from, to), classes })
        },
      )
      expect(tokens).toContainEqual({
        text: expectedText,
        classes: expectedClass,
      })
      const messages = diagnostics.flatMap(spy =>
        spy.mock.calls.map(args => args.map(String).join(' ')),
      )
      expect(
        messages.filter(message => /endless loop/i.test(message)),
      ).toEqual([])
    }
    finally {
      diagnostics.forEach(spy => spy.mockRestore())
    }
  },
)

it.each([
  [
    'json5',
    '{ decimal: 12.5, hex: 0xff, exponent: 1e3 }',
    ['12.5', '0xff', '1e3'],
  ],
  ['yaml', 'enabled: true\ncount: 42\nratio: 12.5\n', ['42', '12.5']],
])(
  'keeps numeric literals highlighted in %s',
  async (language, source, numbers) => {
    const html = await highlightCode(source, language)
    for (const number of numbers)
      expect(html).toContain(`class="cm-number">${number}</span>`)
  },
)

it('highlights INI values', async () => {
  expect(await highlightCode('name=inventory', 'ini')).toContain(
    'class="cm-string">inventory</span>',
  )
})

it.each([
  [
    'prolog',
    'price(12.5). total(42). limit(1e3). % 99\nlabel(\'123\'). label("456").',
  ],
  [
    'raku',
    'my $price = 12.5; my $total = 42; my $limit = 1e3; # 99\nmy $label = \'123\';',
  ],
])(
  'recognizes numbers without coloring string or comment contents in %s',
  async (language, source) => {
    const html = await highlightCode(source, language)
    for (const number of ['12.5', '42', '1e3'])
      expect(html).toContain(`class="cm-number">${number}</span>`)
    expect(html).not.toContain('class="cm-number">99</span>')
    expect(html).not.toContain('class="cm-number">123</span>')
    expect(html).not.toContain('class="cm-number">456</span>')
  },
)

it('handles dotted Properties keys and their values', async () => {
  const html = await highlightCode(
    'service.name=inventory\nservice.port=8080',
    'properties',
  )
  expect(html).toContain('class="cm-def">service.name</span>')
  expect(html).toContain('class="cm-string">inventory</span>')
  expect(html).toContain('class="cm-string">8080</span>')
})

it('recognizes TOML base-prefixed integers', async () => {
  const html = await highlightCode(
    'hex = 0xff\noctal = 0o755\nbinary = 0b1010',
    'toml',
  )
  for (const number of ['0xff', '0o755', '0b1010'])
    expect(html).toContain(`class="cm-number">${number}</span>`)
})

it('distinguishes Raku capture variables and adjacent quoted strings from numbers', async () => {
  const html = await highlightCode(
    'say $0; say $1.Str; say(\'123\'); my $value = 42;',
    'raku',
  )
  expect(html).toContain('class="cm-def">$0</span>')
  expect(html).toContain('class="cm-def">$1</span>')
  expect(html).toContain('class="cm-string">123</span>')
  expect(html).not.toContain('class="cm-number">123</span>')
  expect(html).toContain('class="cm-number">42</span>')
})

it('preserves C++ numbers in macro definitions', async () => {
  expect(await highlightCode('#define MAX_SAMPLES 16', 'c_cpp')).toContain(
    'class="cm-number">16</span>',
  )
})

it('preserves Lua arithmetic operators', async () => {
  expect(await highlightCode('local total = price + tax', 'lua')).toContain(
    'class="cm-operator">+</span>',
  )
})

it('parses Nushell function signatures without an unsupported variable-length lookbehind', async () => {
  const html = await highlightCode(
    'def double [] : [int -> int] { $in * 2 }\nlet count = 42',
    'nu',
  )
  expect(html).toContain('cm-keyword')
  expect(html).toContain('class="cm-number">42</span>')
})

it('preserves complete Raku compound variable names', async () => {
  const html = await highlightCode(
    'my $product-price = 12; say $product-price; my $don\'t = 1;',
    'raku',
  )
  expect(html).toContain('class="cm-def">$product-price</span>')
  expect(html).toContain('class="cm-def">$don\'t</span>')
})
