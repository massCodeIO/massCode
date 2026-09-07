import { describe, expect, it } from 'vitest'
import { HTTP_HISTORY_BODY_LIMIT } from '../../../shared/httpHistory'
import { createHistorySnapshot } from '../historySnapshot'

const request = {
  method: 'POST' as const,
  url: 'https://api.test/items',
  headers: [],
  body: '{"name":"original"}',
}
const response = {
  status: 200,
  statusText: '',
  headers: [],
  body: '{"id":1}',
  bodyKind: 'json' as const,
  durationMs: 3,
  sizeBytes: 8,
  truncated: false,
}

describe('history snapshots', () => {
  it('masks credentials, known secrets and encoded values without changing the response', () => {
    const result = {
      ...response,
      headers: [{ key: 'Set-Cookie', value: 'sid=private' }],
      body: '{"access_token":"private-token","echo":"env secret"}',
    }
    const saved = createHistorySnapshot(
      {
        ...request,
        url: 'https://user:password@api.test/?api_key=url-secret&echo=env+secret',
        headers: [{ key: 'Authorization', value: 'Bearer auth-secret' }],
        body: '{"password":"body-secret","other":"auth-secret"}',
      },
      result,
      ['env secret'],
    )
    const serialized = JSON.stringify(saved)
    for (const secret of [
      'private-token',
      'env secret',
      'url-secret',
      'body-secret',
      'auth-secret',
      'sid=private',
      'user:password',
    ])
      expect(serialized).not.toContain(secret)
    expect(result.body).toContain('private-token')
    expect(saved.response.headers[0].value).toBe('[REDACTED]')
  })
  it('caps both bodies after redaction and reports truncation', () => {
    const saved = createHistorySnapshot(
      { ...request, body: 'x'.repeat(HTTP_HISTORY_BODY_LIMIT + 10) },
      { ...response, body: 'x'.repeat(HTTP_HISTORY_BODY_LIMIT + 10) },
      [],
    )
    expect(saved.request.body.length).toBe(HTTP_HISTORY_BODY_LIMIT)
    expect(saved.request.truncated).toBe(true)
    expect(saved.response.truncated).toBe(true)
  })
  it('retains an independent snapshot and upstream truncation', () => {
    const sent = { ...request }
    const saved = createHistorySnapshot(
      sent,
      { ...response, truncated: true },
      [],
    )
    sent.body = 'changed'
    expect(saved.request.body).toBe(request.body)
    expect(saved.response.truncated).toBe(true)
  })
})
