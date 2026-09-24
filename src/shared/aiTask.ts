import { z } from 'zod'
import { aiHttpDraftSchema } from './aiHttpActions'

export const aiTaskPolicySchema = z.enum(['readOnly', 'apply', 'preview'])
export type AiTaskPolicy = z.infer<typeof aiTaskPolicySchema>
export const aiMutationResultSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['applied', 'cancelled', 'failed']),
    persisted: z.boolean(),
    draft: aiHttpDraftSchema.optional(),
  })
  .strict()
export type AiMutationResult = z.infer<typeof aiMutationResultSchema>
