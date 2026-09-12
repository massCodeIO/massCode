import { describe, expect, it, vi } from 'vitest'
import { findInternalLinks } from '~/shared/notes/internalLinks'
import { groupLinks, resolveInspectorLinks } from '../links'

const resolve = vi.hoisted(() => vi.fn())
vi.mock('@/services/api', () => ({
  api: { internalLinks: { postInternalLinksResolve: resolve } },
}))

describe('note inspector links', () => {
  it('groups aliases of the same object and preserves source positions', () => {
    const text = '[[note:1]] and [[note:1|Alias]] and [[Title]]'
    const item = {
      type: 'note' as const,
      id: 1,
      name: 'Renamed',
      folder: null,
      isDeleted: 0,
    }
    const rows = groupLinks(
      findInternalLinks(text),
      new Map([
        ['note:1', item],
        ['Title', item],
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Renamed')
    expect(
      rows[0]!.occurrences.map(match => text.slice(match.from, match.to)),
    ).toEqual(['[[note:1]]', '[[note:1|Alias]]', '[[Title]]'])
  })
  it('keeps different spaces and planned names separate', () => {
    const text
      = '[[masscode:planned:note|One]] [[masscode:planned:snippet|One]] [[masscode:planned:note|Two]] [[masscode:planned:note|One]]'
    const rows = groupLinks(findInternalLinks(text), new Map())
    expect(
      rows.map(row => [row.type, row.name, row.occurrences.length]),
    ).toEqual([
      ['note', 'One', 2],
      ['snippet', 'One', 1],
      ['note', 'Two', 1],
    ])
    expect(rows.every(row => row.status === 'planned')).toBe(true)
  })
  it('does not report unresolved requests as missing before a response', () => {
    const matches = findInternalLinks('[[note:1]] [[note:2]]')
    expect(
      groupLinks(matches, new Map([['note:1', null]])).map(row => row.status),
    ).toEqual(['missing', 'pending'])
  })
  it('propagates resolution failures rather than marking every link missing', async () => {
    resolve.mockRejectedValueOnce(new Error('offline'))
    await expect(resolveInspectorLinks(['note:1'])).rejects.toThrow('offline')
  })
  it('batches more than 500 targets without dropping targets', async () => {
    resolve.mockImplementation(async ({ titles }: { titles: string[] }) => ({
      data: titles.map(title => ({ title, resolved: null })),
    }))
    const targets = Array.from({ length: 501 }, (_, index) => `note:${index}`)
    resolve.mockClear()
    const result = await resolveInspectorLinks(targets)
    expect(resolve.mock.calls.map(call => call[0].titles.length)).toEqual([
      500,
      1,
    ])
    expect(result.size).toBe(501)
    expect(result.get('note:1')).toBeNull()
  })
})
