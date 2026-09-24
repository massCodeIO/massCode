import { expect, it } from 'vitest'
import { applyAiPatch, inverseAiPatch } from '~/shared/aiUndo'
import { inverseEditorEdits, nativeEditorMutation } from '../taskUndo'

it('restores touched nested fields while retaining independently changed siblings and conflicting leaves', () => {
  const before = {
    properties: { status: 'todo', priority: 'low' },
    runtime: { transport: { timeoutMs: 100 } },
  }
  const after = {
    properties: { status: 'done', priority: 'high' },
    runtime: { transport: { timeoutMs: 500 } },
  }
  const current = {
    properties: { status: 'blocked', priority: 'high', custom: 'manual' },
    runtime: { transport: { timeoutMs: 500, maxRedirects: 4 } },
  }
  const inverse = inverseAiPatch(before, after, current)
  expect(inverse.conflicts).toEqual(['properties.status'])
  expect(applyAiPatch(current, inverse.patch)).toEqual({
    properties: { status: 'blocked', priority: 'low', custom: 'manual' },
    runtime: { transport: { timeoutMs: 100, maxRedirects: 4 } },
  })
})
function editorReceipt(text: string, oldText: string, newText: string) {
  return {
    kind: 'editor' as const,
    snapshot: {
      space: 'notes' as const,
      noteId: 1,
      text,
      from: 0,
      to: text.length,
      contextId: '11111111-1111-4111-8111-111111111111',
      vault: '/vault',
    },
    calls: [
      {
        id: 'edit',
        type: 'function' as const,
        function: {
          name: 'propose_edit' as const,
          arguments: JSON.stringify({
            context_id: '11111111-1111-4111-8111-111111111111',
            summary: 'Change',
            edits: [{ old_text: oldText, new_text: newText }],
          }),
        },
      },
    ],
  }
}
it('anchors an inverse to the original context while preserving independent prefix and suffix', () => {
  const receipt = editorReceipt('before old after', 'old', 'NEW')
  expect(
    inverseEditorEdits(receipt, {
      space: 'notes',
      noteId: 1,
      text: 'manual before NEW after suffix',
    }),
  ).toMatchObject({ text: 'manual before old after suffix', conflicts: [] })
  const text = 'before manually changed after; unrelated NEW'
  expect(
    inverseEditorEdits(receipt, { space: 'notes', noteId: 1, text }),
  ).toMatchObject({ text, conflicts: ['editor'] })
})
it('restores deleted text at its anchored position and refuses to overwrite new manual content', () => {
  expect(
    inverseEditorEdits(editorReceipt('before old after', 'old', ''), {
      space: 'notes',
      noteId: 1,
      text: 'before  after',
    }),
  ).toMatchObject({ text: 'before old after', conflicts: [] })
  expect(
    inverseEditorEdits(editorReceipt('old', 'old', 'NEW'), {
      space: 'notes',
      noteId: 1,
      text: 'manually changed original; unrelated NEW',
    }),
  ).toMatchObject({ conflicts: ['editor'] })
  const receipt = editorReceipt('deleted', 'deleted', '')
  expect(
    inverseEditorEdits(receipt, { space: 'notes', noteId: 1, text: '' }),
  ).toMatchObject({ text: 'deleted', conflicts: [] })
  expect(
    inverseEditorEdits(receipt, { space: 'notes', noteId: 1, text: 'manual' }),
  ).toMatchObject({ text: 'manual', conflicts: ['editor'] })
})
it('undoes an unchanged range after an independent manual paragraph edit', () => {
  const receipt = editorReceipt('alpha\nmiddle\nomega', 'alpha', 'ALPHA')
  expect(
    inverseEditorEdits(receipt, {
      space: 'notes',
      noteId: 1,
      text: 'ALPHA\nMANUAL\nomega',
    }),
  ).toMatchObject({ text: 'alpha\nMANUAL\nomega', conflicts: [] })
})
it('retains only conflicting ranges for a second Undo without replaying the successful inverse', () => {
  const receipt = editorReceipt('alpha\nmiddle\nomega', 'alpha', 'ALPHA')
  const proposal = JSON.parse(receipt.calls[0]!.function.arguments)
  proposal.edits.push({ old_text: 'omega', new_text: 'OMEGA' })
  receipt.calls[0]!.function.arguments = JSON.stringify(proposal)
  const partial = inverseEditorEdits(receipt, {
    space: 'notes',
    noteId: 1,
    text: 'ALPHA\nmiddle\nmanual omega',
  })!
  expect(partial).toMatchObject({
    text: 'alpha\nmiddle\nmanual omega',
    conflicts: ['editor'],
  })
  const remaining = { ...receipt, inverse: partial.inverse }
  expect(
    inverseEditorEdits(remaining, {
      space: 'notes',
      noteId: 1,
      text: 'new manual alpha\nmiddle\nOMEGA',
    }),
  ).toMatchObject({ text: 'new manual alpha\nmiddle\nomega', conflicts: [] })
})
it.each(['', 'OMEGA'])(
  'restores source order for adjacent collapsed ranges (%s)',
  (replacement) => {
    const receipt = editorReceipt('alphaomega', 'alpha', '')
    const proposal = JSON.parse(receipt.calls[0]!.function.arguments)
    proposal.edits.push({ old_text: 'omega', new_text: replacement })
    receipt.calls[0]!.function.arguments = JSON.stringify(proposal)
    expect(
      inverseEditorEdits(receipt, {
        space: 'notes',
        noteId: 1,
        text: replacement,
      }),
    ).toMatchObject({ text: 'alphaomega', conflicts: [] })
  },
)

it('records native insertion into an empty note and preserves independent manual additions on Undo', () => {
  const before = { space: 'notes' as const, noteId: 9, text: '' }
  const receipt = nativeEditorMutation(before, '**new**', '/vault')!
  expect(
    inverseEditorEdits(receipt, { ...before, text: '**new**' })?.text,
  ).toBe('')
  const formatted = nativeEditorMutation(
    { ...before, text: 'one\n\ntwo' },
    '**one**\n\ntwo',
    '/vault',
  )!
  expect(
    inverseEditorEdits(formatted, { ...before, text: '**one**\n\nmanual two' })
      ?.text,
  ).toBe('one\n\nmanual two')
})
