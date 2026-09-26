import { codeHighlighter } from '@/components/cm-extensions/codeHighlight'
import { highlightTree } from '@lezer/highlight'
import { expect, it, vi } from 'vitest'
import { loadLanguageSupport } from '../index'

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

async function classesAt(id: string, source: string, text: string) {
  const support = await loadLanguageSupport(id)
  const from = source.indexOf(text)
  expect(from).toBeGreaterThanOrEqual(0)
  const classes: string[] = []
  highlightTree(
    support!.language.parser.parse(source),
    codeHighlighter,
    (a, b, style) => {
      if (a < from + text.length && b > from)
        classes.push(...style.split(' '))
    },
  )
  return classes
}

it.each([
  ['smalltalk', 'Object subclass: #Catalog', 'subclass:', 'cm-keyword'],
  ['scheme', '(define value 1)', 'define', 'cm-builtin'],
  ['d', 'string label; double price;', 'string', 'cm-type'],
  ['dart', 'String label; double price;', 'String', 'cm-builtin'],
  ['haskell', 'active = True', 'True', 'cm-builtin'],
  ['fsharp', 'type A = { value: float; enabled: bool }', 'float', 'cm-type'],
  ['fsharp', 'let active = true', 'true', 'cm-builtin'],
  ['ocaml', 'let active = false', 'false', 'cm-builtin'],
  ['fortran', 'real :: price', 'real', 'cm-builtin'],
  ['pascal', 'var price: Real;', 'Real', 'cm-type'],
  ['powershell', '$enabled = $true\nGet-Content file', '$true', 'cm-builtin'],
  ['sas', 'data products;\nrun;', 'data', 'cm-builtin'],
  ['sass', '$gap: 12px\n.card\n  padding: $gap', '$gap', 'cm-variable-2'],
  ['scss', '$gap: 12px; .card { padding: $gap; }', '$gap', 'cm-variable-2'],
  ['less', '@gap: 12px; .card { padding: @gap; }', '@gap', 'cm-variable-2'],
  [
    'java',
    'class A { @Override public String toString() { return "a"; } }',
    'Override',
    'cm-meta',
  ],
  ['python', '@dataclass\nclass A:\n  pass', 'dataclass', 'cm-meta'],
  ['perl', 'my $value = 12.5;', '12.5', 'cm-number'],
  ['julia', 'struct Product\nend', 'Product', 'cm-type'],
])('highlights the lost category in %s', async (id, source, text, expected) => {
  expect(await classesAt(id, source, text)).toContain(expected)
})

it.each([
  ['csharp', 'var s = $"Value: {value}";', 'value'],
  // eslint-disable-next-line no-template-curly-in-string
  ['haxe', 'var s = \'Value: ${value}\';', 'value'],
  ['julia', 's = "Value: $(total(items))"', 'total'],
  ['livescript', 's = "Value: #{value}"', 'value'],
  ['perl', 'my $s = "Value: $value";', 'value'],
])(
  'separates interpolated code from string text in %s',
  async (id, source, text) => {
    const classes = await classesAt(id, source, text)
    expect(classes).not.toContain('cm-string')
    expect(classes).toContain('cm-def')
    expect(await classesAt(id, source, 'Value: ')).toContain('cm-string')
  },
)

it.each(['d', 'pascal'])(
  'does not classify type names inside strings or comments in %s',
  async (id) => {
    const source = id === 'd' ? '// string\n"string"' : '{ Real }\n\'Real\''
    const text = id === 'd' ? 'string' : 'Real'
    expect(await classesAt(id, source, text)).toContain('cm-comment')
    const line = source.split('\n')[1]
    expect(await classesAt(id, line, text)).toContain('cm-string')
  },
)

it('highlights AsciiDoc source blocks and returns to prose after the closing fence', async () => {
  const source
    = '[source,javascript]\n----\nconst label = "inventory";\n----  \n\nconst prose = ordinary text\n'
  expect(await classesAt('asciidoc', source, 'const label')).toContain(
    'cm-keyword',
  )
  expect(await classesAt('asciidoc', source, 'const prose')).not.toContain(
    'cm-keyword',
  )
})

it('keeps Haml child tags outside the Ruby attributes of their parent', async () => {
  const source
    = '%ul\n  - products.each do |product|\n    %li{class: "product"}\n      %strong= product[:name]\n      %span.price= product[:price]\n'
  expect(await classesAt('haml', source, 'strong')).toContain('cm-tag')
  expect(await classesAt('haml', source, 'span')).toContain('cm-tag')
})
