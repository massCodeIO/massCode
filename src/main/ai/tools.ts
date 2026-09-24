import type { AiToolCall } from '../../shared/ai'
import { aiProposalSchema, aiToolCallSchema } from '../../shared/ai'
import { AiError } from './errors'

// Some chat templates parse historical arguments as JSON before generation.
// Invalid calls still fail validation; only their protocol replay is normalized.
export function replayToolArguments(argumentsText: string): string {
  try {
    const input = JSON.parse(argumentsText)
    if (input && typeof input === 'object' && !Array.isArray(input))
      return argumentsText
  }
  catch {
    /* The correlated tool result explains the validation failure. */
  }
  return '{}'
}

export function editTool(contextId: string) {
  return {
    type: 'function',
    function: {
      name: 'propose_edit',
      description:
        'Apply user-requested edits to the current editor text context (Code or Notes Markdown), or prepare a preview when explicitly requested. The tool waits for actual persistence or the preview decision. Use when the user asks to change or fix the attached text. Each old_text must match exactly once in the original supplied context, including whitespace. Edits must not overlap. Include enough surrounding text to make each match unique. All edits refer to the original, not to earlier edits. Preserve unrelated text.',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          context_id: { type: 'string', enum: [contextId] },
          summary: {
            type: 'string',
            description:
              'Describe the proposed changes in the user language, using future or conditional tense. They are not applied yet.',
          },
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                old_text: { type: 'string' },
                new_text: { type: 'string' },
              },
              required: ['old_text', 'new_text'],
              additionalProperties: false,
            },
          },
        },
        required: ['context_id', 'summary', 'edits'],
        additionalProperties: false,
      },
    },
  }
}

export function validateToolCalls(
  calls: unknown[],
  contextId?: string,
): AiToolCall[] {
  if (!contextId || calls.length > 8)
    throw new AiError('invalidResponse')
  try {
    const ids = new Set<string>()
    return calls.map((value) => {
      const call = aiToolCallSchema.parse(value)
      const proposal = aiProposalSchema.parse(
        JSON.parse(call.function.arguments),
      )
      if (proposal.context_id !== contextId || ids.has(call.id))
        throw new AiError('invalidResponse')
      ids.add(call.id)
      return call
    })
  }
  catch {
    throw new AiError('invalidResponse')
  }
}
