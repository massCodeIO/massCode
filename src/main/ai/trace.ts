import process from 'node:process'
import { redactAiHttp } from '../../shared/aiHttp'

const MAX_CONTENT = 16 * 1024
export function redactTraceContent(
  value: unknown,
  secrets: string[] = [],
): unknown {
  function clean(item: unknown, depth = 0): unknown {
    if (depth > 16)
      return '[depth limit]'
    if (Array.isArray(item)) {
      return item
        .filter(
          child =>
            !(child && typeof child === 'object' && child.type === 'reasoning'),
        )
        .map(child => clean(child, depth + 1))
    }
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [
          key,
          /encrypted_content|reasoning|authorization|cookie|api.?key|password|secret|credential|access.?token|refresh.?token/i.test(
            key,
          )
            ? '[REDACTED]'
            : clean(child, depth + 1),
        ]),
      )
    }
    if (typeof item !== 'string')
      return item
    let result = item
    for (const secret of secrets.filter(Boolean)) {
      for (const variant of [
        secret,
        encodeURIComponent(secret),
        JSON.stringify(secret).slice(1, -1),
      ])
        result = result.split(variant).join('[REDACTED]')
    }
    try {
      const json = JSON.parse(result)
      if (json && typeof json === 'object') {
        return JSON.stringify(clean(redactAiHttp(json), depth + 1)).slice(
          0,
          MAX_CONTENT,
        )
      }
    }
    catch {
      /* Plain assistant text. */
    }
    return String(redactAiHttp(result))
      .replace(
        /(^|\n)([ \t]*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)[ \t]*:)[^\r\n]*/gi,
        '$1$2 [REDACTED]',
      )
      .replace(/sk-[\w-]+/g, '[REDACTED]')
      .slice(0, MAX_CONTENT)
  }
  return clean(redactAiHttp(value))
}

export function createAiTrace(
  traceId: string,
  provider: string,
  model: string,
  secrets: string[] = [],
) {
  let sequence = 0
  const started = Date.now()
  return {
    nextSpan: () => ++sequence,
    event(
      event: string,
      metadata: Record<string, unknown> = {},
      content?: unknown,
    ) {
      if (process.env.NODE_ENV !== 'development')
        return
      try {
        const record = {
          traceId,
          provider,
          model,
          event,
          elapsedMs: Date.now() - started,
          ...metadata,
          ...(process.env.MASSCODE_AI_LOG_CONTENT === '1'
            && content !== undefined
            ? { content: redactTraceContent(content, secrets) }
            : {}),
        }
        // Console only. No file persistence or renderer forwarding.
        // eslint-disable-next-line no-console
        console.info(
          '[masscode:ai]',
          JSON.stringify(record).slice(0, MAX_CONTENT * 2),
        )
      }
      catch {
        /* Diagnostics must never fail a user request. */
      }
    },
  }
}
export type AiTrace = ReturnType<typeof createAiTrace>
