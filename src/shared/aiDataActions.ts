import { z } from 'zod'

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
} & (
  | { kind: 'import', input: z.infer<typeof aiImportActionSchema> }
  | { kind: 'export', input: z.infer<typeof aiExportActionSchema> }
)
