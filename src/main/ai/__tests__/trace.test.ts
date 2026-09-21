import { afterEach, expect, it, vi } from 'vitest'
import { createAiTrace, redactTraceContent } from '../trace'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
it('logs correlated metadata in dev with content off by default', () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('MASSCODE_AI_LOG_CONTENT', '')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const trace = createAiTrace('trace-1', 'openai', 'model')
  trace.event(
    'request.start',
    { span: trace.nextSpan() },
    { prompt: 'private vault content' },
  )
  trace.event('request.complete', { span: 1 })
  const records = log.mock.calls.map(call => JSON.parse(call[1]))
  expect(records.map(record => record.traceId)).toEqual([
    'trace-1',
    'trace-1',
  ])
  expect(JSON.stringify(records)).not.toContain('private vault')
  expect(records[0].content).toBeUndefined()
})
it('redacts known secrets, nested JSON, HTTP credentials and opaque reasoning on opt-in', () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('MASSCODE_AI_LOG_CONTENT', '1')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const secret = 'known+key'
  const trace = createAiTrace('trace-2', 'openai', 'model', [secret])
  trace.event(
    'request.start',
    {},
    {
      input: [
        {
          type: 'reasoning',
          encrypted_content: 'opaque-unlogged',
          summary: [{ text: 'secret reasoning' }],
        },
        {
          content: JSON.stringify({
            password: 'pass-value',
            headers: [{ key: 'Cookie', value: 'cookie-value' }],
          }),
        },
        {
          content: `Bearer token-value ${secret} ${encodeURIComponent(secret)} sk-private-value`,
        },
      ],
    },
  )
  const text = JSON.stringify(log.mock.calls)
  for (const value of [
    'opaque-unlogged',
    'secret reasoning',
    'pass-value',
    'cookie-value',
    'token-value',
    secret,
    encodeURIComponent(secret),
    'sk-private-value',
  ])
    expect(text).not.toContain(value)
  expect(text).toContain('REDACTED')
})
it('does not log in production even when content flag is set', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('MASSCODE_AI_LOG_CONTENT', '1')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  createAiTrace('id', 'provider', 'model').event('test', {}, 'private')
  expect(log).not.toHaveBeenCalled()
})
it('bounds content and does not mutate provider payload', () => {
  const input = { password: 'secret', content: 'a'.repeat(32000) }
  const sanitized = redactTraceContent(input) as typeof input
  expect(input.password).toBe('secret')
  expect(sanitized.password).toBe('[REDACTED]')
  expect(sanitized.content.length).toBeLessThanOrEqual(16384)
})

it('redacts credentials in raw HTTP header lines', () => {
  const content
    = 'GET / HTTP/1.1\nAuthorization: Basic fixture-basic\r\nCookie: session=fixture-cookie\nX-Api-Key: fixture-key\nSet-Cookie: fixture-session\nAccept: application/json'
  const result = JSON.stringify(redactTraceContent({ content }))
  for (const secret of [
    'fixture-basic',
    'fixture-cookie',
    'fixture-key',
    'fixture-session',
  ])
    expect(result).not.toContain(secret)
  expect(result).toContain('Accept: application/json')
})
