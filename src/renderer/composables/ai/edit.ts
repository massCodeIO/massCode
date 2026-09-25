import type { AiToolCall } from '~/shared/ai'
import { resolveAiEdits } from '~/shared/aiEdits'

export type EditorTarget =
  | { space: 'code', snippetId: number, contentId: number }
  | { space: 'notes', noteId: number }

export type EditSnapshot = EditorTarget & {
  contextId: string
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
  current: (EditorTarget & { text: string }) | undefined,
  vault: string,
) {
  return Boolean(
    current
    && snapshot.vault === vault
    && snapshot.space === current.space
    && (snapshot.space === 'notes'
      ? current.space === 'notes' && snapshot.noteId === current.noteId
      : current.space === 'code'
        && snapshot.snippetId === current.snippetId
        && snapshot.contentId === current.contentId)
      && snapshot.text === current.text,
  )
}
