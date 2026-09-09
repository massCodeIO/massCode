import { describe, expect, it } from 'vitest'
import { applyHttpApiKey } from '../httpAuth'

describe('aPI key authentication', () => {
  it('preserves URL parameters, replaces the key and leaves the draft unchanged', () => {
    const request = {
      url: 'https://example.test?keep=a%26b&token=old',
      auth: {
        type: 'apikey' as const,
        in: 'query' as const,
        key: 'token',
        value: '{{secret}}',
      },
      headers: [],
      query: [],
    }
    const result = applyHttpApiKey(request, { secret: 'a&b' })
    expect(result.query).toEqual([
      { key: 'keep', value: 'a&b' },
      { key: 'token', value: 'a&b' },
    ])
    expect(request.query).toEqual([])
    expect(applyHttpApiKey(result)).toEqual(result)
  })
  it('replaces headers without regard to case', () => {
    const result = applyHttpApiKey({
      auth: { type: 'apikey', key: 'X-Key', value: 'new' },
      query: [],
      headers: [
        { key: 'x-key', value: 'old' },
        { key: 'Authorization', value: 'custom' },
      ],
    })
    expect(result.headers).toEqual([
      { key: 'Authorization', value: 'custom' },
      { key: 'X-Key', value: 'new' },
    ])
  })
})
