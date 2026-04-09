import { describe, expect, it } from 'vitest'
import {
  buildLinkMarkdown,
  escapeLinkPart,
  findInternalLinks,
  parseInternalLink,
  resolveInternalLinkTargetByTitle,
} from '../internalLinks'

describe('parseInternalLink', () => {
  it('parses a link without alias', () => {
    expect(parseInternalLink('[[Repository Pattern with Cache]]')).toEqual({
      alias: null,
      legacyTarget: null,
      label: 'Repository Pattern with Cache',
      raw: '[[Repository Pattern with Cache]]',
      target: 'Repository Pattern with Cache',
    })
  })

  it('parses a link with alias', () => {
    expect(
      parseInternalLink('[[Repository Pattern with Cache|Repo Pattern]]'),
    ).toEqual({
      alias: 'Repo Pattern',
      legacyTarget: null,
      label: 'Repo Pattern',
      raw: '[[Repository Pattern with Cache|Repo Pattern]]',
      target: 'Repository Pattern with Cache',
    })
  })

  it('returns null for invalid input', () => {
    expect(parseInternalLink('[[]]')).toBeNull()
    expect(parseInternalLink('[[|Alias]]')).toBeNull()
    expect(parseInternalLink('not a link')).toBeNull()
  })

  it('handles escaped characters in the target and alias', () => {
    expect(parseInternalLink('[[Array \\] draft|foo \\| bar]]')).toEqual({
      alias: 'foo | bar',
      legacyTarget: null,
      label: 'foo | bar',
      raw: '[[Array \\] draft|foo \\| bar]]',
      target: 'Array ] draft',
    })
  })

  it('handles escaped backslashes', () => {
    expect(parseInternalLink('[[path\\\\file|Alias\\\\Text]]')).toEqual({
      alias: 'Alias\\Text',
      legacyTarget: null,
      label: 'Alias\\Text',
      raw: '[[path\\\\file|Alias\\\\Text]]',
      target: 'path\\file',
    })
  })

  it('keeps legacy type and id metadata for old internal link payloads', () => {
    expect(
      parseInternalLink('[[snippet:57|Repository Pattern with Cache]]'),
    ).toEqual({
      alias: 'Repository Pattern with Cache',
      legacyTarget: { id: 57, type: 'snippet' },
      label: 'Repository Pattern with Cache',
      raw: '[[snippet:57|Repository Pattern with Cache]]',
      target: 'snippet:57',
    })
  })
})

describe('escapeLinkPart', () => {
  it('escapes backslashes', () => {
    expect(escapeLinkPart('path\\file')).toBe('path\\\\file')
  })

  it('escapes pipes', () => {
    expect(escapeLinkPart('foo | bar')).toBe('foo \\| bar')
  })

  it('escapes closing brackets', () => {
    expect(escapeLinkPart('Array ] draft')).toBe('Array \\] draft')
  })
})

describe('buildLinkMarkdown', () => {
  it('builds markdown without alias when display text matches target', () => {
    expect(buildLinkMarkdown('Repository Pattern', 'Repository Pattern')).toBe(
      '[[Repository Pattern]]',
    )
  })

  it('builds markdown with alias when display text differs', () => {
    expect(buildLinkMarkdown('Repository Pattern', 'Repo')).toBe(
      '[[Repository Pattern|Repo]]',
    )
  })

  it('builds markdown with escaped parts', () => {
    expect(buildLinkMarkdown('foo | bar ]', 'Shown ] text')).toBe(
      '[[foo \\| bar \\]|Shown \\] text]]',
    )
  })
})

describe('findInternalLinks', () => {
  it('finds links inside larger text', () => {
    const text = 'See [[Repository Pattern]] and [[Second Doc|Shown]] here'
    const links = findInternalLinks(text)

    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({
      alias: null,
      label: 'Repository Pattern',
      target: 'Repository Pattern',
    })
    expect(links[1]).toMatchObject({
      alias: 'Shown',
      label: 'Shown',
      target: 'Second Doc',
    })
  })

  it('returns source offsets', () => {
    const links = findInternalLinks('See [[Repository Pattern]] end')

    expect(links[0]?.from).toBe(4)
    expect(links[0]?.to).toBe(26)
  })

  it('returns an empty array when there are no links', () => {
    expect(findInternalLinks('no links here')).toEqual([])
  })

  it('does not parse links that cross line breaks', () => {
    expect(findInternalLinks('See [[Repository\nPattern]] here')).toEqual([])
    expect(parseInternalLink('[[Repository\nPattern]]')).toBeNull()
  })
})

describe('resolveInternalLinkTargetByTitle', () => {
  it('prefers an exact snippet title match over a note title match', () => {
    expect(
      resolveInternalLinkTargetByTitle('Architecture', [
        { id: 12, name: 'Architecture', type: 'note' },
        { id: 57, name: 'Architecture', type: 'snippet' },
      ]),
    ).toEqual({
      id: 57,
      type: 'snippet',
    })
  })

  it('returns a note when there is no exact snippet title match', () => {
    expect(
      resolveInternalLinkTargetByTitle('Architecture', [
        { id: 12, name: 'Architecture', type: 'note' },
        { id: 57, name: 'Architecture Draft', type: 'snippet' },
      ]),
    ).toEqual({
      id: 12,
      type: 'note',
    })
  })

  it('does not use partial matches', () => {
    expect(
      resolveInternalLinkTargetByTitle('Architecture', [
        { id: 12, name: 'Architecture Draft', type: 'note' },
        { id: 57, name: 'Architecture Snippet', type: 'snippet' },
      ]),
    ).toBeNull()
  })
})
