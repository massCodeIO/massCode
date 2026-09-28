import { describe, expect, it } from 'vitest'
import {
  applyQueryToUrl,
  applyUrlToQuery,
  getDisplayUrl,
  getPersistedUrl,
  stripQueryFromUrl,
} from '../urlQuery'

describe('http url query helpers', () => {
  it('applies enabled query entries to URL while preserving fragments', () => {
    expect(
      applyQueryToUrl('https://api.example.com/users?stale=true#details', [
        { key: 'page', value: '1' },
        { enabled: false, key: 'debug', value: 'true' },
      ]),
    ).toBe('https://api.example.com/users?page=1#details')
  })

  it('uses query entries for editor display but persists base URL separately', () => {
    const displayUrl = getDisplayUrl('https://api.example.com/users', [
      { key: 'active', value: 'true' },
    ])

    expect(displayUrl).toBe('https://api.example.com/users?active=true')
    expect(
      getPersistedUrl(displayUrl, [{ key: 'active', value: 'true' }]),
    ).toBe('https://api.example.com/users')
  })

  it('keeps URL-only query strings for editor display', () => {
    expect(getDisplayUrl('https://api.example.com/users?active=true', [])).toBe(
      'https://api.example.com/users?active=true',
    )
  })

  it('keeps URL-only query strings when there are no param entries', () => {
    expect(
      getPersistedUrl('https://api.example.com/users?active=true', []),
    ).toBe('https://api.example.com/users?active=true')
  })

  it('strips query strings without dropping fragments', () => {
    expect(
      stripQueryFromUrl('https://api.example.com/users?active=true#top'),
    ).toBe('https://api.example.com/users#top')
  })

  it('parses URL query into enabled entries and preserves disabled params', () => {
    expect(
      applyUrlToQuery('https://api.example.com/users?page=2', [
        { description: 'Page number', key: 'page', value: '1' },
        { enabled: false, key: 'debug', value: 'true' },
      ]),
    ).toEqual([
      { description: 'Page number', enabled: true, key: 'page', value: '2' },
      { enabled: false, key: 'debug', value: 'true' },
    ])
  })
  it('decodes URL values once, preserving duplicate keys, plus semantics and malformed percent signs', () => {
    expect(
      applyUrlToQuery(
        'https://api.test/?value=a%26b%3Dc%2Bd%25&dup=1&dup=2&space=a+b&bad=100%',
        [],
      ),
    ).toEqual([
      { key: 'value', value: 'a&b=c+d%', enabled: true, description: '' },
      { key: 'dup', value: '1', enabled: true, description: '' },
      { key: 'dup', value: '2', enabled: true, description: '' },
      { key: 'space', value: 'a b', enabled: true, description: '' },
      { key: 'bad', value: '100%', enabled: true, description: '' },
    ])
  })
  it('roundtrips reserved characters and keeps interpolation tokens readable', () => {
    const query = [
      { key: 'a&b', value: 'a&b=c+d%# ü/{{token}}' },
      { key: '{{key}}', value: '{{value}}' },
    ]
    const url = applyQueryToUrl('{{baseUrl}}/path#anchor', query)
    expect(url).toContain('a%26b=a%26b%3Dc%2Bd%25%23%20%C3%BC%2F{{token}}')
    expect(url).toContain('{{key}}={{value}}#anchor')
    expect(
      applyUrlToQuery(url, []).map(({ key, value }) => ({ key, value })),
    ).toEqual(query)
  })
  it('keeps raw encoded parameters byte-for-byte when automatic URL encoding is disabled', () => {
    const url = 'https://api.test/?q=a%20b+c&value=a%26b#anchor'
    const query = applyUrlToQuery(url, [], false)
    expect(query.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: 'q', value: 'a%20b+c' },
      { key: 'value', value: 'a%26b' },
    ])
    expect(applyQueryToUrl(url, query, false)).toBe(url)
    expect(getDisplayUrl('https://api.test/#anchor', query, false)).toBe(url)
  })
})
