import type { AiToolCall } from '~/shared/ai'
import { resolveAiEdits } from '~/shared/aiEdits'

export interface EditSnapshot {
  contextId: string
  snippetId: number
  contentId: number
  text: string
  from: number
  to: number
  vault: string
}

export function buildReplacement(
  snapshot: EditSnapshot,
  calls: AiToolCall[],
): string | undefined {
  const result = resolveAiEdits(
    snapshot.contextId,
    snapshot.text.slice(snapshot.from, snapshot.to),
    calls,
  )
  return result.ok ? result.replacement : undefined
}

export function matchesSnapshot(
  snapshot: EditSnapshot,
  current: { snippetId: number, contentId: number, text: string } | undefined,
  vault: string,
) {
  return Boolean(
    current
    && snapshot.vault === vault
    && snapshot.snippetId === current.snippetId
    && snapshot.contentId === current.contentId
    && snapshot.text === current.text,
  )
}
