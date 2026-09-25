import { describe, expect, it } from 'vitest'
import { AI_HTTP_BODY_LIMIT, httpContextText, redactAiHttp } from '../aiHttp'

describe('hTTP AI snapshot privacy', () => {
  it('masks credentials in auth, headers, query, JSON bodies and URLs', () => {
    const text = httpContextText({
      auth: { type: 'api-key', key: 'X-Custom', value: 'auth-value' },
      headers: [
        { key: 'Authorization', value: 'Basic abc123' },
        { key: 'Set-Cookie', value: 'session=cookie-value' },
      ],
      query: [{ key: 'api_key', value: 'query-value' }],
      body: '{"access_token":"body-value","id":42}',
      url: 'https://name:pass@example.com?token=url-value',
    })
    for (const secret of [
      'auth-value',
      'abc123',
      'cookie-value',
      'query-value',
      'body-value',
      'name:pass',
      'url-value',
    ])
      expect(text).not.toContain(secret)
    expect(text).toContain('42')
  })
  it('bounds output and labels truncation', () => {
    const text = httpContextText({
      body: 'x'.repeat(AI_HTTP_BODY_LIMIT + 100),
    })
    expect(text.length).toBeLessThanOrEqual(AI_HTTP_BODY_LIMIT)
    expect(text).toContain('[TRUNCATED:')
  })
  it('redacts expected token values while keeping type checks intact', () => {
    expect(
      redactAiHttp([
        {
          name: 'token',
          source: 'json',
          path: '/token',
          operator: 'eq',
          expected: 'private',
        },
      ]),
    ).toEqual([
      {
        name: 'token',
        source: 'json',
        path: '/token',
        operator: 'eq',
        expected: '[REDACTED]',
      },
    ])
  })
})

it('redacts nested header tuples, name/value records and raw HTTP text', () => {
  const values = {
    body: JSON.stringify({
      headers: [
        ['Cookie', 'tuple-cookie'],
        ['Authorization', 'Basic tuple-auth'],
        ['X-API-Key', 'tuple-key'],
        ['Accept', 'application/json'],
      ],
    }),
    named: [{ name: 'Set-Cookie', value: 'named-cookie' }],
    raw: 'GET / HTTP/1.1\r\nAuthorization: Basic raw-auth\r\nCookie: raw-cookie\r\nX-API-Key: raw-key',
  }
  const result = httpContextText(values)
  for (const secret of [
    'tuple-cookie',
    'tuple-auth',
    'tuple-key',
    'named-cookie',
    'raw-auth',
    'raw-cookie',
    'raw-key',
  ])
    expect(result).not.toContain(secret)
  expect(result).toContain('application/json')
})

it('preserves the original tail when the snapshot exceeds its limit', () => {
  const text = httpContextText({
    body: `${'x'.repeat(AI_HTTP_BODY_LIMIT + 100)}QA-END`,
  })
  expect(text).toContain('QA-END')
  expect(text.length).toBeLessThanOrEqual(AI_HTTP_BODY_LIMIT)
})
