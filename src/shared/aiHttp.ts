import { z } from 'zod'
import { httpRuntimeSchema } from './httpRuntime'

export const AI_HTTP_BODY_LIMIT = 1024 * 1024
export const aiHttpContextSchema = z
  .object({
    contextId: z.uuid(),
    requestId: z.number().int().positive(),
    name: z.string().max(1000),
    request: z.string().max(AI_HTTP_BODY_LIMIT),
    response: z.string().max(AI_HTTP_BODY_LIMIT).nullable(),
    assertions: httpRuntimeSchema.shape.assertions,
  })
  .strict()
export type AiHttpContext = z.infer<typeof aiHttpContextSchema>
export const aiHttpProposalSchema = z
  .object({
    context_id: z.uuid(),
    summary: z.string().min(1).max(2000),
    analysis: z.string().trim().max(4000).optional(),
    assertions: httpRuntimeSchema.shape.assertions.min(1),
    evidence: z
      .array(
        z
          .object({
            assertionIndex: z.number().int().min(0).max(99),
            source: z.enum(['user', 'description']),
            quote: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict()
export type AiHttpProposal = z.infer<typeof aiHttpProposalSchema>

const sensitiveKey
  = /authorization|cookie|password|passwd|secret|token|api[-_]?key|credential/i
// Keep placeholders intact; never resolve credentials for the AI context.
export function redactAiHttp(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (
      value.length === 2
      && typeof value[0] === 'string'
      && sensitiveKey.test(value[0])
    ) {
      return [value[0], '[REDACTED]']
    }
    return value.map(redactAiHttp)
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const sensitiveEntry
      = typeof (record.key ?? record.name) === 'string'
        && sensitiveKey.test(String(record.key ?? record.name))
    return Object.fromEntries(
      Object.entries(record).map(([key, child]) => [
        key,
        sensitiveKey.test(key)
        || (sensitiveEntry && key === 'value')
        || (record.type === 'file' && key === 'value')
        || (record.bodyType === 'binary' && key === 'body')
          ? '[REDACTED]'
          : key === 'expected'
            && sensitiveKey.test(String(record.path ?? record.name ?? ''))
            ? Array.isArray(child)
              ? child.map(item =>
                  typeof item === 'string' ? '[REDACTED]' : item,
                )
              : typeof child === 'string'
                ? '[REDACTED]'
                : child
            : key === 'auth' && child && typeof child === 'object'
              ? { type: (child as Record<string, unknown>).type }
              : redactAiHttp(child),
      ]),
    )
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object')
        return JSON.stringify(redactAiHttp(parsed))
    }
    catch {}
    return value
      .replace(
        /(^|\n)([ \t]*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)[ \t]*:)[^\r\n]*/gi,
        '$1$2 [REDACTED]',
      )
      .replace(/(Bearer\s+)[^\s"'<>]+/gi, '$1[REDACTED]')
      .replace(
        /((?:password|secret|token|api[_-]?key|authorization|cookie)[^=\s&]*=)[^&\s]+/gi,
        '$1[REDACTED]',
      )
      .replace(
        /((?:https?|wss?):\/\/)[^\s/@][^\s/:@]*:[^\s/@]+@/gi,
        '$1[REDACTED]@',
      )
  }
  return value
}

export function httpContextText(value: unknown) {
  const text = JSON.stringify(redactAiHttp(value))
  return text.length <= AI_HTTP_BODY_LIMIT
    ? text
    : `${text.slice(0, AI_HTTP_BODY_LIMIT - 4096 - 64)}\n[TRUNCATED: middle omitted; original tail follows]\n${text.slice(-4096)}`
}
