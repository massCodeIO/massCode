import { z } from 'zod'

export const aiClarificationSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    options: z
      .array(z.string().trim().min(1).max(200))
      .min(2)
      .max(4)
      .optional(),
  })
  .strict()
export type AiClarification = z.infer<typeof aiClarificationSchema> & {
  id: string
  answer?: string
  cancelled?: boolean
}
export const aiSteerSchema = z
  .object({ requestId: z.uuid(), text: z.string().trim().min(1).max(8000) })
  .strict()
export const aiClarificationAnswerSchema = z
  .object({
    requestId: z.uuid(),
    id: z.uuid(),
    answer: z.string().trim().min(1).max(8000),
  })
  .strict()
export const clarificationTool = {
  type: 'function' as const,
  function: {
    name: 'ask_user',
    description:
      'Ask one concise question only when a missing decision prevents correct work. Supply 2–4 options when helpful; a free answer is always allowed. Await the answer in this same task. Do not use for permissions already represented by native action previews.',
    parameters: z.toJSONSchema(aiClarificationSchema, { io: 'input' }),
  },
}
