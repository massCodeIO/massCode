import { z } from 'zod'
import { aiHttpProposalSchema } from '../../shared/aiHttp'
import {
  httpExpectedSchema,
  httpRuntimeSchema,
} from '../../shared/httpRuntime'

// Wire schema: strict function calling requires every property, using null for
// inapplicable fields. The runtime schema still validates operator semantics.
const assertion = httpRuntimeSchema.shape.assertions.element
export const httpProposalToolSchema = z
  .object({
    ...aiHttpProposalSchema.shape,
    analysis: z
      .string()
      .max(4000)
      .nullable()
      .describe(
        'Answer any analysis/question in the user request using the inspected response, in the user language. Be concise. State observations and important uncertainty. Do not enumerate the proposed checks, repeat their summary, or claim they ran. Use null for an edit-only request with nothing else to explain.',
      ),
    assertions: z
      .array(
        z
          .object({
            ...assertion.shape,
            source: assertion.shape.source.describe(
              'Required for EVERY check: status, json, header, or durationMs. This is the measured response property, not the evidence source.',
            ),
            path: z
              .string()
              .nullable()
              .describe(
                'JSON Pointer for json; header name for header; null for status and durationMs.',
              ),
            expected: httpExpectedSchema.describe(
              'Comparison operand. Use null for exists/type checks; null is also a valid explicit JSON equality operand.',
            ),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    evidence: aiHttpProposalSchema.shape.evidence
      .unwrap()
      .describe(
        'Sources of requirements for comparisons. Use an empty array when no comparisons require evidence.',
      ),
  })
  .strict()

export function parseHttpProposal(input: unknown) {
  // Local providers may omit nullable wire fields. Do not infer missing source,
  // expected values or evidence, and preserve explicit eq null comparisons.
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const record = input as Record<string, unknown>
    return aiHttpProposalSchema.parse({
      ...record,
      analysis: record.analysis === null ? undefined : record.analysis,
      assertions: Array.isArray(record.assertions)
        ? record.assertions.map(rule =>
            rule && typeof rule === 'object' && !Array.isArray(rule)
              ? { ...rule, path: rule.path === null ? undefined : rule.path }
              : rule,
          )
        : record.assertions,
    })
  }
  return aiHttpProposalSchema.parse(input)
}
