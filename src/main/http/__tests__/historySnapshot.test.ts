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
  it('redacts every duplicate credential query value even when echoed in a response', () => {
    const snapshot = createHistorySnapshot(
      {
        ...request,
        url: 'https://api.test/?token=first-secret&token=second-secret',
      },
      { ...response, body: 'first-secret second-secret', bodyKind: 'text' },
      [],
    )
    expect(snapshot.response.body).toBe('[REDACTED] [REDACTED]')
  })

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
      {
        ...response,
        bodyKind: 'text',
        body: 'x'.repeat(HTTP_HISTORY_BODY_LIMIT + 10),
      },
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
  it.each([
    {
      body: '{"access_token":"new-token","profile":"truncated',
      truncated: true,
    },
    { body: '{"access_token":"new-token",invalid}', truncated: false },
  ])(
    'does not persist credentials from invalid structured responses: $truncated',
    (payload) => {
      const saved = createHistorySnapshot(
        request,
        { ...response, ...payload },
        [],
      )
      expect(saved.response.body).toBe('[REDACTED]')
      expect(JSON.stringify(saved)).not.toContain('new-token')
      expect(saved.response.truncated).toBe(payload.truncated)
    },
  )
  it('fails closed for malformed JSON requests and JSON advertised as text', () => {
    const saved = createHistorySnapshot(
      { ...request, body: '{"password":"new-request-secret",' },
      {
        ...response,
        bodyKind: 'text',
        headers: [{ key: 'Content-Type', value: 'application/problem+json' }],
        body: 'invalid new-response-secret',
      },
      [],
    )
    expect(saved.request.body).toBe('[REDACTED]')
    expect(saved.response.body).toBe('[REDACTED]')
  })
  it('masks newly issued form response credentials and preserves ordinary fields', () => {
    const saved = createHistorySnapshot(
      request,
      {
        ...response,
        bodyKind: 'text',
        headers: [
          {
            key: 'Content-Type',
            value: 'Application/X-WWW-Form-Urlencoded; charset=utf-8',
          },
        ],
        body: 'oauth_token=new%2ftoken&oauth_token_secret=new+secret&name=ordinary+value&name=second',
      },
      [],
    )
    const form = new URLSearchParams(saved.response.body)
    expect(form.get('oauth_token')).toBe('[REDACTED]')
    expect(form.get('oauth_token_secret')).toBe('[REDACTED]')
    expect(form.getAll('name')).toEqual(['ordinary value', 'second'])
    expect(saved.response.body).not.toContain('new')
  })
  it('keeps ordinary text responses unchanged', () => {
    const saved = createHistorySnapshot(
      request,
      {
        ...response,
        bodyKind: 'text',
        body: 'Ordinary response',
      },
      [],
    )
    expect(saved.response.body).toBe('Ordinary response')
  })
})
