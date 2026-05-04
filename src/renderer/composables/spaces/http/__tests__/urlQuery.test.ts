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
})
