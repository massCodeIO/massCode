import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../markdown'

describe('aI response Markdown', () => {
  it('renders headings, lists, tables and code', () => {
    const html = renderMarkdown(
      '# Title\n\n- **bold** and `code`\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\nconst a = 1\n```',
    )
    for (const tag of ['h1', 'ul', 'strong', 'code', 'table', 'pre'])
      expect(html).toContain(`<${tag}`)
  })

  it('renders incomplete streamed fences and escapes code', () => {
    const partial = '```html\n<script>alert(1)</script>'
    expect(renderMarkdown(partial)).toContain('&lt;script&gt;')
    expect(renderMarkdown(partial)).toContain('</code></pre>')
    expect(renderMarkdown(`${partial}\n\`\`\``)).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('does not execute HTML, load images or allow unsafe links', () => {
    const html = renderMarkdown(
      '<img src=x onerror=alert(1)>\n\n![image](https://example.com/track)\n\n[x](javascript:alert(1))\n\n[x](file:///tmp/test)',
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('href="file:')
    expect(html).toContain('&lt;img')
    expect(renderMarkdown('[site](https://example.com)')).toContain(
      'href="https://example.com"',
    )
  })
})
