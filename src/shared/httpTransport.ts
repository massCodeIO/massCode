import { z } from 'zod'

export const httpTransportSchema = z.object({
  timeoutMs: z.number().int().min(0).max(2147483647).optional(),
  maxResponseBytes: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  protocolVersion: z.enum(['http1', 'auto', 'http2']).optional(),
  encodeUrl: z.boolean().optional(),
  followOriginalHttpMethod: z.boolean().optional(),
  followAuthorizationHeader: z.boolean().optional(),
  removeRefererHeaderOnRedirect: z.boolean().optional(),
  followRedirects: z.boolean().optional(),
  maxRedirects: z.number().int().min(0).max(100).optional(),
  skipCertificateVerification: z.boolean().optional(),
})
export type HttpTransport = z.infer<typeof httpTransportSchema>

export const HTTP_TRANSPORT_DEFAULTS = {
  protocolVersion: 'http1' as 'http1' | 'auto' | 'http2',
  encodeUrl: true,
  followAuthorizationHeader: false,
  removeRefererHeaderOnRedirect: false,
  timeoutMs: 30_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRedirects: 5,
  skipCertificateVerification: false,
}

export function resolveHttpTransport(
  defaults: HttpTransport,
  overrides: HttpTransport = {},
  restricted = false,
) {
  const result: HttpTransport &
    typeof HTTP_TRANSPORT_DEFAULTS & { followRedirects: boolean } = {
      ...HTTP_TRANSPORT_DEFAULTS,
      followRedirects: !restricted,
    }
  for (const source of [defaults, overrides]) {
    const parsed = httpTransportSchema.parse(source)
    for (const key of Object.keys(parsed) as (keyof HttpTransport)[]) {
      if (parsed[key] !== undefined)
        Object.assign(result, { [key]: parsed[key] })
    }
  }
  return result
}
