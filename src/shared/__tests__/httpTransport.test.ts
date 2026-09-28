import { expect, it } from 'vitest'
import { httpTransportSchema, resolveHttpTransport } from '../httpTransport'

it('preserves legacy defaults and allows explicit settings for restricted requests', () => {
  expect(resolveHttpTransport({})).toMatchObject({
    timeoutMs: 30000,
    maxResponseBytes: 10485760,
    maxRedirects: 5,
    followRedirects: true,
    skipCertificateVerification: false,
  })
  expect(resolveHttpTransport({}, {}, true).followRedirects).toBe(false)
  expect(
    resolveHttpTransport({ followRedirects: true }, {}, true).followRedirects,
  ).toBe(true)
})
it('inherits TLS defaults and respects explicit false and zero overrides', () => {
  const defaults = {
    skipCertificateVerification: true,
    timeoutMs: 30000,
    maxResponseBytes: 10,
    maxRedirects: 5,
  }
  expect(resolveHttpTransport(defaults).skipCertificateVerification).toBe(true)
  expect(
    resolveHttpTransport(defaults, {
      skipCertificateVerification: false,
      timeoutMs: 0,
      maxResponseBytes: 0,
      maxRedirects: 0,
    }),
  ).toMatchObject({
    skipCertificateVerification: false,
    timeoutMs: 0,
    maxResponseBytes: 0,
    maxRedirects: 0,
  })
})
it.each([
  { timeoutMs: -1 },
  { timeoutMs: 2147483648 },
  { timeoutMs: 0.5 },
  { maxResponseBytes: Number.NaN },
  { maxResponseBytes: Infinity },
  { maxResponseBytes: -1 },
  { maxRedirects: 101 },
  { maxRedirects: '5' },
  { followRedirects: 'true' },
])('rejects invalid transport values %j', (value) => {
  expect(httpTransportSchema.safeParse(value).success).toBe(false)
})

it('accepts exact transport boundaries without coercion', () => {
  expect(
    httpTransportSchema.parse({
      timeoutMs: 2147483647,
      maxResponseBytes: Number.MAX_SAFE_INTEGER,
      maxRedirects: 100,
    }),
  ).toEqual({
    timeoutMs: 2147483647,
    maxResponseBytes: Number.MAX_SAFE_INTEGER,
    maxRedirects: 100,
  })
  expect(httpTransportSchema.safeParse({ maxRedirects: -1 }).success).toBe(
    false,
  )
  expect(httpTransportSchema.safeParse({ maxRedirects: 0.5 }).success).toBe(
    false,
  )
})

it('inherits every redirect and encoding setting and preserves explicit false overrides', () => {
  const defaults = {
    timeoutMs: 1200,
    maxResponseBytes: 2 * 1024 * 1024,
    protocolVersion: 'auto' as const,
    encodeUrl: false,
    followRedirects: false,
    maxRedirects: 1,
    followOriginalHttpMethod: true,
    followAuthorizationHeader: true,
    removeRefererHeaderOnRedirect: true,
  }
  expect(
    resolveHttpTransport(defaults, { timeoutMs: undefined }),
  ).toMatchObject(defaults)
  expect(
    resolveHttpTransport(defaults, {
      protocolVersion: 'http1',
      encodeUrl: true,
      followRedirects: true,
      maxRedirects: 5,
      followOriginalHttpMethod: false,
      followAuthorizationHeader: false,
      removeRefererHeaderOnRedirect: false,
    }),
  ).toMatchObject({
    timeoutMs: 1200,
    maxResponseBytes: 2097152,
    protocolVersion: 'http1',
    encodeUrl: true,
    followRedirects: true,
    maxRedirects: 5,
    followOriginalHttpMethod: false,
    followAuthorizationHeader: false,
    removeRefererHeaderOnRedirect: false,
  })
  expect(defaults.followOriginalHttpMethod).toBe(true)
})
