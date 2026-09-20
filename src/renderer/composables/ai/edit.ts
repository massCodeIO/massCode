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

export function editLines(before: string, after: string) {
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  let start = 0
  while (
    start < oldLines.length
    && start < newLines.length
    && oldLines[start] === newLines[start]
  ) {
    start++
  }
  let end = 0
  while (
    end < oldLines.length - start
    && end < newLines.length - start
    && oldLines[oldLines.length - 1 - end] === newLines[newLines.length - 1 - end]
  ) {
    end++
  }
  return [
    ...oldLines.slice(0, start).map(text => ({ type: 'same', text })),
    ...oldLines
      .slice(start, oldLines.length - end)
      .map(text => ({ type: 'removed', text })),
    ...newLines
      .slice(start, newLines.length - end)
      .map(text => ({ type: 'added', text })),
    ...oldLines
      .slice(oldLines.length - end)
      .map(text => ({ type: 'same', text })),
  ]
}
