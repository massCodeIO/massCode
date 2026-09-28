import { describe, expect, it } from 'vitest'
import { workspaceFieldsSchema } from '../aiWorkspace'
import { applyHttpApiKey } from '../httpAuth'
import { httpCollectionSchema } from '../httpCollection'

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

  it('replaces every exact query-key duplicate while preserving a case variant', () => {
    const result = applyHttpApiKey({
      auth: { type: 'apikey', in: 'query', key: 'token', value: 'fresh' },
      headers: [],
      query: [
        { key: 'token', value: 'old-one' },
        { key: 'Token', value: 'case-variant' },
        { key: 'token', value: 'old-two' },
      ],
    })
    expect(result.query).toEqual([
      { key: 'Token', value: 'case-variant' },
      { key: 'token', value: 'fresh' },
    ])
  })
})

it.each(['oauth', 'oauth2', 'digest', 'ntlm', 'aws', 'client-cert'])(
  'rejects unsupported %s auth in workspace and collection contracts',
  (type) => {
    expect(workspaceFieldsSchema.shape.auth.safeParse({ type }).success).toBe(
      false,
    )
    expect(httpCollectionSchema.shape.auth.safeParse({ type }).success).toBe(
      false,
    )
  },
)
