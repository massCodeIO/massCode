import { z } from 'zod'

// Preserve SDK protocol metadata (including thought signatures), never render it.
const providerOptions = z
  .record(z.string(), z.record(z.string(), z.json()))
  .optional()
const text = z.string().max(1024 * 1024)
const id = z.string().min(1).max(256)
export const aiSdkReplaySchema = z
  .object({
    provider: z.enum(['anthropic', 'gemini', 'deepseek', 'mistral', 'xai']),
    model: id,
    content: z
      .array(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('text'), text, providerOptions }).strict(),
          z
            .object({ type: z.literal('reasoning'), text, providerOptions })
            .strict(),
          z
            .object({
              type: z.literal('tool-call'),
              toolCallId: id,
              toolName: id,
              input: z.json(),
              providerOptions,
              providerExecuted: z.literal(false).optional(),
            })
            .strict(),
        ]),
      )
      .max(128),
    providerOptions,
  })
  .strict()
export type AiSdkReplay = z.infer<typeof aiSdkReplaySchema>
