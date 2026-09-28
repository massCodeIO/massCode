import type { AiToolCall } from './ai'
import { aiProposalSchema } from './ai'

export type EditValidation =
  | { ok: true, replacement: string }
  | {
    ok: false
    reason:
      | 'invalid'
      | 'target'
      | 'missing'
      | 'ambiguous'
      | 'overlap'
      | 'limit'
  }

export function resolveAiEdits(
  contextId: string,
  original: string,
  calls: AiToolCall[],
): EditValidation {
  const edits: { from: number, to: number, text: string }[] = []
  try {
    for (const call of calls) {
      const proposal = aiProposalSchema.parse(
        JSON.parse(call.function.arguments),
      )
      if (proposal.context_id !== contextId)
        return { ok: false, reason: 'target' }
      for (const edit of proposal.edits) {
        const from = original.indexOf(edit.old_text)
        if (from < 0)
          return { ok: false, reason: 'missing' }
        if (original.includes(edit.old_text, from + 1))
          return { ok: false, reason: 'ambiguous' }
        edits.push({
          from,
          to: from + edit.old_text.length,
          text: edit.new_text,
        })
      }
    }
  }
  catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!edits.length || edits.length > 64)
    return { ok: false, reason: 'limit' }
  edits.sort((a, b) => a.from - b.from)
  if (
    edits.some((edit, index) => index > 0 && edits[index - 1]!.to > edit.from)
  )
    return { ok: false, reason: 'overlap' }
  let result = original
  for (const edit of edits.toReversed())
    result = result.slice(0, edit.from) + edit.text + result.slice(edit.to)
  return { ok: true, replacement: result }
}
