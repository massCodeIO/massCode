import { describe, expect, it, vi } from 'vitest'
import { highlightCode } from '../highlight'
import { renderMarkdownBlocks } from '../markdown'

vi.mock('onigasm', async () => {
  const { createRequire } = await import('node:module')
  const { readFileSync } = await import('node:fs')
  const require = createRequire(import.meta.url)
  const actual = require('onigasm')
  return {
    loadWASM: () => {
      const bytes = readFileSync(require.resolve('onigasm/lib/onigasm.wasm'))
      return actual.loadWASM(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      )
    },
  }
})

describe('chat code blocks', () => {
  it('extracts nested and unfinished fences from Markdown tokens', () => {
    const result = renderMarkdownBlocks(
      '> ```js\n> const a = 1\n> ```\n\n- Example\n\n  ```python\n  print(1)\n  ```\n\n```unknown\n<unsafe>',
    )
    expect(result.blocks.map(block => block.language)).toEqual([
      'js',
      'python',
      'unknown',
    ])
    expect(result.blocks[2].code).toBe('<unsafe>')
    expect(result.html).toContain('data-ai-code="2"')
    expect(result.html).toContain('<blockquote>')
    expect(result.html).not.toContain('<unsafe>')
  })
  it('highlights known languages and escapes unknown language content', async () => {
    expect(await highlightCode('const x = "<script>"', 'javascript')).toContain(
      'cm-keyword',
    )
    expect(
      await highlightCode('<script>alert(1)</script>', 'no-such-language'),
    ).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
  it('reuses snippet grammars for aliases and multiline code', async () => {
    expect(await highlightCode('const x = 1', 'js')).toContain('cm-keyword')
    expect(await highlightCode('def greet():\n    return 1', 'py')).toContain(
      'cm-keyword',
    )
    expect(await highlightCode('fn main() {}', 'rust')).toContain('cm-keyword')
    const html = await highlightCode(
      '/* first\nsecond */\nconst x = "<script>"',
      'js',
    )
    expect(html).toContain('cm-comment')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

it('preserves CRLF and escapes multiline tokens without leaking state between blocks', async () => {
  const source = '/* <unsafe>\r\n\r\nend */\r\nconst x = 1'
  const html = await highlightCode(source, 'js')
  expect(html.match(/\r\n/g)).toHaveLength(3)
  expect(html).not.toContain('<unsafe>')
  expect(html).toContain('cm-comment')
  expect(await highlightCode('const x = 1', 'js')).toContain('cm-keyword')
  expect(await highlightCode('const x = 1', 'js')).not.toContain('cm-comment')
})

it('keeps each highlighted line balanced for static image rendering', async () => {
  for (const source of [
    '/* first\nsecond\nlast */',
    'const s = `first\nsecond`',
  ]) {
    const html = await highlightCode(source, 'javascript')
    for (const line of html.split('\n')) {
      expect(line.match(/<span /g)?.length ?? 0).toBe(
        line.match(/<\/span>/g)?.length ?? 0,
      )
    }
    expect(html.split('\n')[1]).toContain('cm-')
  }
})

it('highlights PHP snippets without opening tags', async () => {
  const html = await highlightCode('function hello() { return "yes"; }', 'php')
  expect(html).toMatch(/class="cm-keyword">function<\/span>/)
  expect(html).toMatch(/class="cm-keyword">return<\/span>/)
  expect(html).toContain('cm-string')
})
it('highlights JavaScript keywords and numbers inside Markdown fences', async () => {
  const html = await highlightCode('```js\nconst x=1\n```', 'markdown')
  expect(html).toMatch(/class="cm-keyword">const<\/span>/)
  expect(html).toMatch(/class="cm-number">1<\/span>/)
})
