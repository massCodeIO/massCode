import { describe, expect, it } from 'vitest'
import { buildHttpFormBody, readHttpFormEntries } from '../httpForm'

describe('hTTP form compatibility', () => {
  it('retains legacy bytes until edited and decodes them into editable rows', () => {
    const legacy = 'space=hello+world&tag=one&tag=two&special=a%26b%3Dc%2Bd%25'
    expect(buildHttpFormBody(legacy, [])).toBe(legacy)
    const rows = readHttpFormEntries(legacy, [])
    expect(rows.at(-1)?.value).toBe('a&b=c+d%')
    expect([...new URLSearchParams(buildHttpFormBody(null, rows))]).toEqual([
      ...new URLSearchParams(legacy),
    ])
  })
  it('encodes interpolated keys and values once while skipping disabled fields', () => {
    const rows = [
      {
        key: '{{key}}',
        value: '{{value}}',
        type: 'text' as const,
        description: 'Docs',
      },
      { key: 'off', value: '/missing', type: 'file' as const, enabled: false },
      { key: 'empty', value: '', type: 'text' as const },
    ]
    const body = buildHttpFormBody(null, rows, {
      key: 'a&b',
      value: '{{literal}} +%✓',
    })
    expect([...new URLSearchParams(body)]).toEqual([
      ['a&b', '{{literal}} +%✓'],
      ['empty', ''],
    ])
    expect(rows[0].description).toBe('Docs')
  })
})
