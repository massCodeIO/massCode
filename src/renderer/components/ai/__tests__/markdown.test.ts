import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderMarkdownBlocks } from '../markdown'

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

describe('verified vault references', () => {
  const item = {
    type: 'http_request' as const,
    id: 470,
    name: 'Recent orders',
  }

  it('links only the first mention across prose, emphasis and inline code', () => {
    const result = renderMarkdownBlocks(
      'Recent orders, **Recent orders**, `Recent orders`.',
      [item],
    )
    expect(result.references).toEqual([item])
    expect(result.html.match(/data-ai-reference=/g)).toHaveLength(1)
  })

  it('does not link ambiguous names, unknown records or partial words', () => {
    expect(
      renderMarkdownBlocks('Recent orders', [item, { ...item, id: 471 }])
        .references,
    ).toEqual([])
    expect(
      renderMarkdownBlocks('Recent orders', [item, { ...item, type: 'note' }])
        .references,
    ).toEqual([])
    expect(
      renderMarkdownBlocks('Recent ordersXYZ and Unknown', [item]).references,
    ).toEqual([])
    expect(
      renderMarkdownBlocks('Recent orders', [item, item]).references,
    ).toEqual([item])
  })

  it('preserves external links and fenced code', () => {
    const result = renderMarkdownBlocks(
      '[Recent orders](https://example.com)\n\n```js\nRecent orders\n```',
      [item],
    )
    expect(result.references).toEqual([])
    expect(result.html).toContain('href="https://example.com"')
    expect(result.blocks[0]?.code).toBe('Recent orders\n')
  })

  it('escapes HTML and matches punctuation in record names literally', () => {
    const special = { type: 'snippet' as const, id: 2, name: 'C++ (example)' }
    const result = renderMarkdownBlocks(
      '<script>alert(1)</script> C++ (example)',
      [special],
    )
    expect(result.references).toEqual([special])
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })
})

it('does not link another item by a shorter name inside an undone creation title', () => {
  const item = { type: 'http_request' as const, id: 7, name: 'Create user' }
  const result = renderMarkdownBlocks(
    'Создание Project Create user было отменено. Другой запрос: Create user.',
    [item],
    ['Project Create user'],
  )
  expect(result.references).toEqual([item])
  expect(result.html).toContain('Создание Project Create user было отменено.')
  expect(result.html).toContain(
    'Другой запрос: <span data-ai-reference="0"></span>',
  )
})

it('keeps undone full titles unlinked across formatting without disabling other references', () => {
  const items = [
    { type: 'note' as const, id: 1, name: 'Plan' },
    { type: 'note' as const, id: 2, name: 'Other' },
  ]
  const result = renderMarkdownBlocks(
    '**Release Plan** и `Release Plan`, Other',
    items,
    ['Release Plan'],
  )
  expect(result.references).toEqual([items[1]])
  expect(result.html).toContain('<strong>Release Plan</strong>')
  expect(result.html).toContain('<code>Release Plan</code>')
})
