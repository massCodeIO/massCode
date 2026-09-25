import { z } from 'zod'
import { redactAiHttp } from './aiHttp'

export const aiImportActionSchema = z
  .object({
    space: z.enum(['code', 'notes', 'http']),
    source: z.enum([
      'github-gists',
      'obsidian',
      'raycast-snippets',
      'snippetslab',
      'vscode-snippets',
      'http-files',
    ]),
  })
  .strict()
  .refine(
    value => (value.space === 'http') === (value.source === 'http-files'),
  )
export const aiExportActionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('note'),
      id: z.number().int().positive(),
      format: z.enum(['html', 'pdf']),
      source: z.enum(['saved', 'current']),
    })
    .strict(),
  z
    .object({ kind: z.literal('notesFolder'), id: z.number().int().positive() })
    .strict(),
])
// These are untrusted native receipt details, never executable instructions.
export const aiDataWarningsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            source: z.string().max(200),
            message: z.string().max(1000),
          })
          .strict(),
      )
      .max(50),
    // Count in the native receipt, which may itself already be capped.
    count: z.number().int().nonnegative().max(1000000),
    truncated: z.boolean(),
  })
  .strict()
  .refine(
    value =>
      value.count >= value.items.length
      && (value.count === value.items.length || value.truncated),
  )
export type AiDataWarnings = z.infer<typeof aiDataWarningsSchema>

export function sanitizeAiDataWarnings(
  warnings: AiDataWarnings,
): AiDataWarnings {
  let truncated = warnings.truncated || warnings.items.length > 50
  const items = warnings.items.slice(0, 50).map((warning) => {
    // Redact before cutting strings so credentials cannot be split at the limit.
    const source = String(redactAiHttp(warning.source))
    const message = String(redactAiHttp(warning.message))
    truncated ||= source.length > 200 || message.length > 1000
    return { source: source.slice(0, 200), message: message.slice(0, 1000) }
  })
  return { items, count: warnings.count, truncated }
}

export type AiDataAction = {
  id: string
  status:
    | 'pending'
    | 'opened'
    | 'previewed'
    | 'applied'
    | 'cancelled'
    | 'failed'
  summary?: Record<string, number>
  warnings?: AiDataWarnings
} & (
  | { kind: 'import', input: z.infer<typeof aiImportActionSchema> }
  | { kind: 'export', input: z.infer<typeof aiExportActionSchema> }
)

export const aiDataActionResultSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['applied', 'cancelled', 'failed']),
    summary: z.record(z.string(), z.number()).optional(),
    warnings: aiDataWarningsSchema.optional(),
  })
  .strict()
export type AiDataActionResult = z.infer<typeof aiDataActionResultSchema>
