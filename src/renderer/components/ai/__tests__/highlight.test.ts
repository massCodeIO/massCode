import { describe, expect, it } from 'vitest'
import { highlightCode } from '../highlight'
import { renderMarkdownBlocks } from '../markdown'

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
      'tok-keyword',
    )
    expect(
      await highlightCode('<script>alert(1)</script>', 'no-such-language'),
    ).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
