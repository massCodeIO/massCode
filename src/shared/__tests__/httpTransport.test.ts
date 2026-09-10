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
