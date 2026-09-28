import { expect, it, vi } from 'vitest'
import { getCodeFormatterParser } from '../../../../shared/codeFormatter'
import { format } from '../prettier'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
vi.mock('../../../store', () => ({
  store: {
    preferences: {
      get: () => ({
        tabSize: 2,
        trailingComma: 'all',
        semi: true,
        singleQuote: true,
      }),
    },
  },
}))
it.each([
  ['css', 'a{color:red}', 'a {'],
  ['html', '<div><span>x</span></div>', '<div>'],
  ['json', '{"a":1}', '"a": 1'],
  ['json5', '{a:1}', 'a: 1'],
  ['less', '@c:red;a{color:@c}', '@c: red'],
  ['markdown', '# Heading\n\n- item', '# Heading'],
  ['scss', '$c:red;a{color:$c}', '$c: red'],
  ['typescript', 'const a:number=1', 'a: number = 1'],
  ['yaml', 'a: [1,2]', 'a: [1, 2]'],
  ['javascript', 'const a=1', 'const a = 1;'],
  ['graphqlschema', 'type Query{hello:String}', 'hello: String'],
])(
  'formats real %s using the installed parser',
  async (language, source, expected) => {
    const parser = getCodeFormatterParser(language)!
    const formatted = await format(source, parser)
    expect(formatted).toContain(expected)
    expect(await format(formatted, parser)).toBe(formatted)
  },
)
it.each([
  ['css', 'a {'],
  ['html', '<!--'],
  ['json', '{"a":'],
  ['json5', '{a:'],
  ['less', 'a {'],
  ['scss', 'a {'],
  ['typescript', 'const ='],
  ['yaml', 'a: ['],
  ['javascript', 'const ='],
  ['graphqlschema', 'type Query {'],
])(
  'rejects malformed %s rather than claiming formatting succeeded',
  async (language, source) => {
    await expect(
      format(source, getCodeFormatterParser(language)!),
    ).rejects.toThrow()
  },
)
it.each([
  'dockerfile',
  'gitignore',
  'properties',
  'ini',
  'sh',
  'java',
  'php',
  'sass',
  'toml',
  'xml',
  'jade',
  '__proto__',
])('does not expose unsupported language/parser %s', async (language) => {
  expect(getCodeFormatterParser(language)).toBeUndefined()
  await expect(format('source', language)).rejects.toThrow(
    'UNSUPPORTED_FORMATTER',
  )
})

it('does not invent a Markdown syntax failure for permissive Markdown text', async () => {
  await expect(format('```\nunfinished fence', 'markdown')).resolves.toContain(
    'unfinished fence',
  )
})
