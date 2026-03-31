import { describe, expect, it } from 'vitest'
import {
  buildLinkMarkdown,
  escapeLabel,
  findInternalLinks,
  parseInternalLink,
} from '../parser'

describe('parseInternalLink', () => {
  it('parses a snippet link', () => {
    expect(parseInternalLink('[[snippet:42|My Snippet]]')).toEqual({
      type: 'snippet',
      id: 42,
      label: 'My Snippet',
      raw: '[[snippet:42|My Snippet]]',
    })
  })

  it('parses a note link', () => {
    expect(parseInternalLink('[[note:15|My Note Title]]')).toEqual({
      type: 'note',
      id: 15,
      label: 'My Note Title',
      raw: '[[note:15|My Note Title]]',
    })
  })

  it('returns null for invalid input', () => {
    expect(parseInternalLink('[[invalid:42|Name]]')).toBeNull()
    expect(parseInternalLink('[[snippet:abc|Name]]')).toBeNull()
    expect(parseInternalLink('[[snippet:42]]')).toBeNull()
    expect(parseInternalLink('not a link')).toBeNull()
  })

  it('handles escaped characters in the label', () => {
    expect(parseInternalLink('[[note:15|Array \\] draft]]')).toEqual({
      type: 'note',
      id: 15,
      label: 'Array ] draft',
      raw: '[[note:15|Array \\] draft]]',
    })
  })

  it('handles escaped pipe in the label', () => {
    expect(parseInternalLink('[[snippet:42|foo \\| bar]]')).toEqual({
      type: 'snippet',
      id: 42,
      label: 'foo | bar',
      raw: '[[snippet:42|foo \\| bar]]',
    })
  })

  it('handles escaped backslash in the label', () => {
    expect(parseInternalLink('[[snippet:1|path\\\\file]]')).toEqual({
      type: 'snippet',
      id: 1,
      label: 'path\\file',
      raw: '[[snippet:1|path\\\\file]]',
    })
  })
})

describe('escapeLabel', () => {
  it('escapes backslashes', () => {
    expect(escapeLabel('path\\file')).toBe('path\\\\file')
  })

  it('escapes pipes', () => {
    expect(escapeLabel('foo | bar')).toBe('foo \\| bar')
  })

  it('escapes closing brackets', () => {
    expect(escapeLabel('Array ] draft')).toBe('Array \\] draft')
  })
})

describe('buildLinkMarkdown', () => {
  it('builds markdown with escaped labels', () => {
    expect(buildLinkMarkdown('note', 5, 'foo | bar ]')).toBe(
      '[[note:5|foo \\| bar \\]]]',
    )
  })
})

describe('findInternalLinks', () => {
  it('finds links inside larger text', () => {
    const text = 'See [[snippet:1|Foo]] and [[note:2|Bar]] here'
    const links = findInternalLinks(text)

    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ type: 'snippet', id: 1, label: 'Foo' })
    expect(links[1]).toMatchObject({ type: 'note', id: 2, label: 'Bar' })
  })

  it('returns source offsets', () => {
    const links = findInternalLinks('See [[snippet:1|Foo]] end')

    expect(links[0]?.from).toBe(4)
    expect(links[0]?.to).toBe(21)
  })

  it('returns an empty array when there are no links', () => {
    expect(findInternalLinks('no links here')).toEqual([])
  })
})
