import { describe, expect, it } from 'vitest'
import {
  buildLinkMarkdown,
  escapeLinkPart,
  findInternalLinks,
  parseInternalLink,
  resolveInternalLinkTargetByTitle,
  rewriteInternalLinkTarget,
  splitInternalLinkTarget,
} from '../internalLinks'

describe('parseInternalLink', () => {
  it('parses a link without alias', () => {
    expect(parseInternalLink('[[Repository Pattern with Cache]]')).toEqual({
      alias: null,
      basename: 'Repository Pattern with Cache',
      legacyTarget: null,
      label: 'Repository Pattern with Cache',
      pathSegments: [],
      raw: '[[Repository Pattern with Cache]]',
      target: 'Repository Pattern with Cache',
    })
  })

  it('parses a link with alias', () => {
    expect(
      parseInternalLink('[[Repository Pattern with Cache|Repo Pattern]]'),
    ).toEqual({
      alias: 'Repo Pattern',
      basename: 'Repository Pattern with Cache',
      legacyTarget: null,
      label: 'Repo Pattern',
      pathSegments: [],
      raw: '[[Repository Pattern with Cache|Repo Pattern]]',
      target: 'Repository Pattern with Cache',
    })
  })

  it('parses a link with a folder path', () => {
    expect(parseInternalLink('[[Projects/Repository Pattern]]')).toEqual({
      alias: null,
      basename: 'Repository Pattern',
      legacyTarget: null,
      label: 'Projects/Repository Pattern',
      pathSegments: ['Projects'],
      raw: '[[Projects/Repository Pattern]]',
      target: 'Projects/Repository Pattern',
    })
  })

  it('parses a link with a nested folder path', () => {
    expect(parseInternalLink('[[Work/Projects/Repository Pattern]]')).toEqual({
      alias: null,
      basename: 'Repository Pattern',
      legacyTarget: null,
      label: 'Work/Projects/Repository Pattern',
      pathSegments: ['Work', 'Projects'],
      raw: '[[Work/Projects/Repository Pattern]]',
      target: 'Work/Projects/Repository Pattern',
    })
  })

  it('parses a path-based link with alias', () => {
    expect(parseInternalLink('[[Projects/Repository Pattern|Repo]]')).toEqual({
      alias: 'Repo',
      basename: 'Repository Pattern',
      legacyTarget: null,
      label: 'Repo',
      pathSegments: ['Projects'],
      raw: '[[Projects/Repository Pattern|Repo]]',
      target: 'Projects/Repository Pattern',
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
      basename: 'Array ] draft',
      legacyTarget: null,
      label: 'foo | bar',
      pathSegments: [],
      raw: '[[Array \\] draft|foo \\| bar]]',
      target: 'Array ] draft',
    })
  })

  it('handles escaped backslashes', () => {
    expect(parseInternalLink('[[path\\\\file|Alias\\\\Text]]')).toEqual({
      alias: 'Alias\\Text',
      basename: 'path\\file',
      legacyTarget: null,
      label: 'Alias\\Text',
      pathSegments: [],
      raw: '[[path\\\\file|Alias\\\\Text]]',
      target: 'path\\file',
    })
  })

  it('keeps legacy type and id metadata for old internal link payloads', () => {
    expect(
      parseInternalLink('[[snippet:57|Repository Pattern with Cache]]'),
    ).toEqual({
      alias: 'Repository Pattern with Cache',
      basename: 'snippet:57',
      legacyTarget: { id: 57, type: 'snippet' },
      label: 'Repository Pattern with Cache',
      pathSegments: [],
      raw: '[[snippet:57|Repository Pattern with Cache]]',
      target: 'snippet:57',
    })
  })
})

describe('splitInternalLinkTarget', () => {
  it('treats a target without slashes as a bare basename', () => {
    expect(splitInternalLinkTarget('My Note')).toEqual({
      basename: 'My Note',
      pathSegments: [],
    })
  })

  it('extracts the trailing segment as the basename', () => {
    expect(splitInternalLinkTarget('Projects/My Note')).toEqual({
      basename: 'My Note',
      pathSegments: ['Projects'],
    })
  })

  it('handles deeply nested paths', () => {
    expect(splitInternalLinkTarget('Work/2026/Q2/Plans')).toEqual({
      basename: 'Plans',
      pathSegments: ['Work', '2026', 'Q2'],
    })
  })

  it('strips leading slashes and empty segments', () => {
    expect(splitInternalLinkTarget('/Projects//My Note')).toEqual({
      basename: 'My Note',
      pathSegments: ['Projects'],
    })
  })

  it('does not split legacy id-based targets', () => {
    expect(splitInternalLinkTarget('snippet:57')).toEqual({
      basename: 'snippet:57',
      pathSegments: [],
    })
    expect(splitInternalLinkTarget('note:42')).toEqual({
      basename: 'note:42',
      pathSegments: [],
    })
  })

  it('returns empty fields for trailing-slash-only targets', () => {
    expect(splitInternalLinkTarget('Projects/')).toEqual({
      basename: 'Projects',
      pathSegments: [],
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

describe('rewriteInternalLinkTarget', () => {
  it('rewrites a plain link target', () => {
    expect(
      rewriteInternalLinkTarget(
        'See [[Old Name]] for details',
        'Old Name',
        'New Name',
      ),
    ).toBe('See [[New Name]] for details')
  })

  it('keeps the alias when rewriting a target', () => {
    expect(
      rewriteInternalLinkTarget(
        'See [[Old Name|shown text]] for details',
        'Old Name',
        'New Name',
      ),
    ).toBe('See [[New Name|shown text]] for details')
  })

  it('matches case-insensitively', () => {
    expect(
      rewriteInternalLinkTarget(
        'See [[old name]] and [[OLD NAME]]',
        'Old Name',
        'New Name',
      ),
    ).toBe('See [[New Name]] and [[New Name]]')
  })

  it('rewrites multiple occurrences in one pass', () => {
    expect(
      rewriteInternalLinkTarget(
        '[[Old]] before [[Old|alias]] middle [[Other]] end',
        'Old',
        'New',
      ),
    ).toBe('[[New]] before [[New|alias]] middle [[Other]] end')
  })

  it('escapes special characters in the new target', () => {
    expect(
      rewriteInternalLinkTarget('See [[Old]] here', 'Old', 'foo | bar'),
    ).toBe('See [[foo \\| bar]] here')
  })

  it('returns null when nothing changes', () => {
    expect(
      rewriteInternalLinkTarget('See [[Other]] end', 'Old', 'New'),
    ).toBeNull()
    expect(rewriteInternalLinkTarget('no links here', 'Old', 'New')).toBeNull()
  })

  it('does not rewrite legacy id-based targets', () => {
    expect(
      rewriteInternalLinkTarget(
        'See [[note:42]] and [[Old]]',
        'note:42',
        'Something',
      ),
    ).toBeNull()
    expect(
      rewriteInternalLinkTarget('See [[note:42|Old]]', 'Old', 'New'),
    ).toBeNull()
  })

  it('skips matches that the predicate rejects', () => {
    expect(
      rewriteInternalLinkTarget(
        '[[Old]] keep [[Old|alias]] rewrite',
        'Old',
        'New',
        match => match.alias !== null,
      ),
    ).toBe('[[Old]] keep [[New|alias]] rewrite')
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

  it('resolves a path-based target to the matching note in that folder', () => {
    expect(
      resolveInternalLinkTargetByTitle('Projects/Architecture', [
        { folderPath: '', id: 1, name: 'Architecture', type: 'note' },
        { folderPath: 'Projects', id: 2, name: 'Architecture', type: 'note' },
        { folderPath: 'Other', id: 3, name: 'Architecture', type: 'note' },
      ]),
    ).toEqual({ id: 2, type: 'note' })
  })

  it('resolves a nested path-based target', () => {
    expect(
      resolveInternalLinkTargetByTitle('Work/2026/Plans', [
        { folderPath: 'Work', id: 1, name: 'Plans', type: 'note' },
        { folderPath: 'Work/2026', id: 2, name: 'Plans', type: 'note' },
      ]),
    ).toEqual({ id: 2, type: 'note' })
  })

  it('matches path-based targets case-insensitively', () => {
    expect(
      resolveInternalLinkTargetByTitle('projects/architecture', [
        { folderPath: 'Projects', id: 1, name: 'Architecture', type: 'note' },
      ]),
    ).toEqual({ id: 1, type: 'note' })
  })

  it('returns null when path-based target has no matching note', () => {
    expect(
      resolveInternalLinkTargetByTitle('Missing/Architecture', [
        { folderPath: 'Projects', id: 1, name: 'Architecture', type: 'note' },
      ]),
    ).toBeNull()
  })

  it('does not match snippets via path-based targets', () => {
    expect(
      resolveInternalLinkTargetByTitle('Projects/Architecture', [
        { id: 1, name: 'Architecture', type: 'snippet' },
      ]),
    ).toBeNull()
  })

  it('prefers a note in the linker folder when multiple notes share the basename', () => {
    expect(
      resolveInternalLinkTargetByTitle(
        'Foo',
        [
          { folderPath: '', id: 1, name: 'Foo', type: 'note' },
          { folderPath: 'Work', id: 2, name: 'Foo', type: 'note' },
          { folderPath: 'Work/Projects', id: 3, name: 'Foo', type: 'note' },
        ],
        { linkerFolderPath: 'Work/Projects' },
      ),
    ).toEqual({ id: 3, type: 'note' })
  })

  it('walks up to the linker parent when no match is in the same folder', () => {
    expect(
      resolveInternalLinkTargetByTitle(
        'Foo',
        [
          { folderPath: '', id: 1, name: 'Foo', type: 'note' },
          { folderPath: 'Work', id: 2, name: 'Foo', type: 'note' },
        ],
        { linkerFolderPath: 'Work/Projects' },
      ),
    ).toEqual({ id: 2, type: 'note' })
  })

  it('reaches the root folder during the ancestor walk', () => {
    expect(
      resolveInternalLinkTargetByTitle(
        'Foo',
        [
          { folderPath: '', id: 1, name: 'Foo', type: 'note' },
          { folderPath: 'Other', id: 2, name: 'Foo', type: 'note' },
        ],
        { linkerFolderPath: 'Work/Projects' },
      ),
    ).toEqual({ id: 1, type: 'note' })
  })

  it('falls back to the first candidate when no ancestor matches', () => {
    expect(
      resolveInternalLinkTargetByTitle(
        'Foo',
        [
          { folderPath: 'Other', id: 1, name: 'Foo', type: 'note' },
          { folderPath: 'Stuff', id: 2, name: 'Foo', type: 'note' },
        ],
        { linkerFolderPath: 'Work/Projects' },
      ),
    ).toEqual({ id: 1, type: 'note' })
  })

  it('returns the single matching note without proximity context', () => {
    expect(
      resolveInternalLinkTargetByTitle('Foo', [
        { folderPath: 'Work/Projects', id: 1, name: 'Foo', type: 'note' },
      ]),
    ).toEqual({ id: 1, type: 'note' })
  })
})
