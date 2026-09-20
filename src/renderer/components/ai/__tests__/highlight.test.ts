import { describe, expect, it, vi } from 'vitest'
import { highlightCode } from '../highlight'
import { renderMarkdownBlocks } from '../markdown'

// Real TextMate grammars and WASM, using the official DOM-free CM stream.
vi.mock('codemirror', async () => {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  return { default: require('codemirror/addon/runmode/runmode.node.js') }
})
vi.mock('codemirror-textmate', async () => {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const cm = require('codemirror/addon/runmode/runmode.node.js')
  cm.defineInitHook = () => {}
  const id = require.resolve('codemirror')
  const previous = require.cache[id]
  require.cache[id] = { exports: cm } as never
  try {
    return require('codemirror-textmate')
  }
  finally {
    if (previous)
      require.cache[id] = previous
    else delete require.cache[id]
  }
})
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
