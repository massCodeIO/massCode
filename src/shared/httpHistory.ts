import { z } from 'zod'

export const HTTP_HISTORY_LIMITS = [0, 10, 20, 50, 100] as const
export const HTTP_HISTORY_DEFAULT_LIMIT = 20
export const HTTP_HISTORY_BODY_LIMIT = 1024 * 1024

const headers = z.array(z.object({ key: z.string(), value: z.string() }))
export const httpHistorySnapshotSchema = z.object({
  request: z.object({
    method: z.enum([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
    ]),
    url: z.string(),
    headers,
    body: z.string(),
    truncated: z.boolean(),
  }),
  response: z.object({
    status: z.number().nullable(),
    headers,
    body: z.string(),
    bodyKind: z.enum(['text', 'json', 'binary']),
    truncated: z.boolean(),
    error: z.string().optional(),
  }),
})

export type HttpHistorySnapshot = z.infer<typeof httpHistorySnapshotSchema>
