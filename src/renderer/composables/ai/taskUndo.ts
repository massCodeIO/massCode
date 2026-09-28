import type { EditorTarget, EditSnapshot } from './edit'
import type { HttpAiSnapshot } from './useHttpAi'
import type { AiToolCall } from '~/shared/ai'
import type { NativePreferenceMutation } from '~/shared/aiNativePreferences'
import { diff } from '@codemirror/merge'
import { aiProposalSchema } from '~/shared/ai'
import { buildReplacement } from './edit'

interface EditorInverse {
  text: string
  ranges: {
    from: number
    to: number
    oldText: string
    callIndex: number
    editIndex: number
  }[]
}

export type TaskMutation =
  | NativePreferenceMutation
  | { kind: 'tasksCleanup', id: string, vault: string, undone?: boolean }
  | {
    kind: 'folderIcon'
    id: string
    vault: string
    space: 'code' | 'notes' | 'http'
    undone?: boolean
  }
  | { kind: 'workspace', id: string, index: number, undone?: boolean }
  | {
    kind: 'editor'
    snapshot: EditSnapshot
    calls: AiToolCall[]
    inverse?: EditorInverse
    undone?: boolean
  }
  | {
    kind: 'httpDraft'
    before: HttpAiSnapshot
    after: HttpAiSnapshot
    undone?: boolean
  }

export function inverseEditorEdits(
  receipt: Extract<TaskMutation, { kind: 'editor' }>,
  current: EditorTarget & { text: string },
) {
  const target = receipt.snapshot
  if (
    target.space !== current.space
    || (target.space === 'notes'
      ? current.space !== 'notes' || target.noteId !== current.noteId
      : current.space !== 'code'
        || target.snippetId !== current.snippetId
        || target.contentId !== current.contentId)
  ) {
    return undefined
  }
  let inverse = receipt.inverse
  if (!inverse) {
    const replacement = buildReplacement(target, receipt.calls)
    if (replacement === undefined)
      return undefined
    const original = target.text.slice(target.from, target.to)
    const ranges = receipt.calls
      .flatMap((call, callIndex) =>
        aiProposalSchema
          .parse(JSON.parse(call.function.arguments))
          .edits
          .map((edit, editIndex) => ({
            from: target.from + original.indexOf(edit.old_text),
            oldText: edit.old_text,
            newText: edit.new_text,
            callIndex,
            editIndex,
          })),
      )
      .sort((a, b) => a.from - b.from)
    let offset = 0
    inverse = {
      text:
        target.text.slice(0, target.from)
        + replacement
        + target.text.slice(target.to),
      ranges: ranges.map((range) => {
        const from = range.from + offset
        offset += range.newText.length - range.oldText.length
        return {
          from,
          to: from + range.newText.length,
          oldText: range.oldText,
          callIndex: range.callIndex,
          editIndex: range.editIndex,
        }
      }),
    }
  }
  const changes = diff(inverse.text, current.text, {
    scanLimit: 10000,
    timeout: 50,
  })
  const remaining: typeof inverse.ranges = []
  const replacements: { from: number, to: number, text: string }[] = []
  for (const range of inverse.ranges) {
    // Compare positions in the complete receipt, never search for replacement
    // text elsewhere. A coarse diff conservatively reports a conflict.
    const touched = changes.some(change =>
      range.from === range.to
        ? change.fromA <= range.from && change.toA >= range.to
        : change.fromA < range.to && change.toA > range.from,
    )
    const wholeDocument = range.from === 0 && range.to === inverse.text.length
    if (touched || (wholeDocument && changes.length)) {
      remaining.push(range)
      continue
    }
    const shift = changes
      .filter(change => change.toA <= range.from)
      .reduce(
        (sum, change) =>
          sum + (change.toB - change.fromB) - (change.toA - change.fromA),
        0,
      )
    const from = range.from + shift
    const to = range.to + shift
    if (
      current.text.slice(from, to) !== inverse.text.slice(range.from, range.to)
    ) {
      remaining.push(range)
      continue
    }
    replacements.push({ from, to, text: range.oldText })
  }
  let text = current.text
  for (const replacement of replacements
    .reverse()
    .sort((a, b) => b.from - a.from)) {
    text
      = text.slice(0, replacement.from)
        + replacement.text
        + text.slice(replacement.to)
  }
  // Keep the original positions for unresolved ranges. Successful inverses
  // become ordinary differences and cannot be replayed on the next attempt.
  return {
    text,
    conflicts: remaining.length ? ['editor'] : [],
    inverse: { ...inverse, ranges: remaining },
  }
}

export function nativeEditorMutation(
  before: EditorTarget & { text: string },
  after: string,
  vault: string,
): Extract<TaskMutation, { kind: 'editor' }> | undefined {
  if (before.text === after)
    return undefined
  const changes = diff(before.text, after, { scanLimit: 10000, timeout: 50 })
  return {
    kind: 'editor',
    snapshot: {
      ...before,
      contextId: crypto.randomUUID(),
      from: 0,
      to: before.text.length,
      vault,
    },
    calls: [],
    inverse: {
      text: after,
      ranges: changes.map((change, index) => ({
        from: change.fromB,
        to: change.toB,
        oldText: before.text.slice(change.fromA, change.toA),
        callIndex: 0,
        editIndex: index,
      })),
    },
  }
}
