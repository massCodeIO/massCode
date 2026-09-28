import { describe, expect, it, vi } from 'vitest'
import { findExternalLinks } from '../externalLinks'
import { groupExternalLinks } from '../links'

vi.mock('@/services/api', () => ({ api: {} }))

describe('external inspector links', () => {
  it('finds Markdown, autolinks and bare URLs with exact source positions', () => {
    const content
      = '[Guide](https://example.com/a_(b) "Title") <https://example.org> https://example.net.'
    const links = findExternalLinks(content)
    expect(links.map(link => link.url)).toEqual([
      'https://example.com/a_(b)',
      'https://example.org',
      'https://example.net',
    ])
    expect(links[0]!.alias).toBe('Guide')
    expect(content[links[0]!.cursor]).toBe(']')
    for (const link of links)
      expect(content.slice(link.from, link.to)).toBe(link.raw)
  })
  it('excludes code, images, internal links and unsupported protocols', () => {
    const content
      = '`https://code.example`\n\n```js\nhttps://fence.example\n```\n\n![Image](https://image.example) [[note:1|https://alias.example]] [bad](javascript:alert(1)) [mail](mailto:a@example.com)'
    expect(findExternalLinks(content)).toEqual([])
  })
  it('resolves reference links without counting the definition itself', () => {
    expect(
      findExternalLinks('[Guide][docs]\n\n[docs]: https://example.com').map(
        link => [link.alias, link.url],
      ),
    ).toEqual([['Guide', 'https://example.com']])
  })
  it('groups duplicate URLs and preserves labels and occurrence positions', () => {
    const rows = groupExternalLinks(
      '[Docs](https://example.com) [Reference](https://example.com) https://example.com',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Docs',
      url: 'https://example.com',
      aliases: ['Reference'],
      status: 'external',
      type: 'external',
    })
    expect(rows[0]!.occurrences).toHaveLength(3)
  })
})
