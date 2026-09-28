import { z } from 'zod'

const id = z.string().min(1).max(256)
const text = z.string().max(1024 * 1024)
// Replay only the output types supported by this text/function assistant.
export const aiResponseItemSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('reasoning'),
      id,
      summary: z
        .array(z.object({ type: z.literal('summary_text'), text }))
        .max(64),
      encrypted_content: text.nullable().optional(),
      status: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('message'),
      id,
      role: z.literal('assistant'),
      status: z.literal('completed'),
      phase: z.enum(['commentary', 'final_answer']).nullable().optional(),
      content: z
        .array(
          z.discriminatedUnion('type', [
            z.object({
              type: z.literal('output_text'),
              text,
              annotations: z.array(z.unknown()).max(256).default([]),
            }),
            z.object({ type: z.literal('refusal'), refusal: text }),
          ]),
        )
        .max(64),
    })
    .passthrough(),
  z
    .object({
      type: z.literal('function_call'),
      id,
      call_id: id,
      name: id,
      arguments: text,
      status: z.literal('completed').optional(),
    })
    .passthrough(),
])
export const aiResponseReplaySchema = z
  .object({
    model: id,
    items: z.array(aiResponseItemSchema).max(128),
  })
  .strict()
export type AiResponseReplay = z.infer<typeof aiResponseReplaySchema>
