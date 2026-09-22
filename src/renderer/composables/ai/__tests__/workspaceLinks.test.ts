import type { ChatMessage } from '../useAi'
import { expect, it } from 'vitest'
import { unavailableWorkspaceItems } from '../workspaceLinks'

function message(
  action: 'trash' | 'restore' | 'delete',
  kind: 'item' | 'folder',
  undone = false,
): ChatMessage {
  return {
    role: 'assistant',
    content: '',
    workspaceApplied: undone ? [] : [0],
    workspaceUndone: undone ? [0] : [],
    workspaceProposal: {
      id: action,
      summary: '',
      changes: [
        {
          name: 'Name',
          operation: { space: 'notes', kind, action, id: 42, fields: {} },
          before: JSON.stringify({
            record: { isDeleted: action === 'restore' ? 1 : 0 },
            affectedItems: [{ id: 43 }],
          }),
          after: '{}',
        },
      ],
    },
  }
}
it('suppresses old item and descendant links until restore or Undo succeeds', () => {
  expect(
    unavailableWorkspaceItems([message('trash', 'item')]).has('note:42'),
  ).toBe(true)
  expect(
    unavailableWorkspaceItems([message('trash', 'item', true)]).has('note:42'),
  ).toBe(false)
  expect(
    unavailableWorkspaceItems([
      message('trash', 'item'),
      message('restore', 'item'),
    ]).has('note:42'),
  ).toBe(false)
  expect(
    unavailableWorkspaceItems([
      message('trash', 'item'),
      message('restore', 'item', true),
    ]).has('note:42'),
  ).toBe(true)
  expect(
    unavailableWorkspaceItems([message('delete', 'folder')]).has('note:43'),
  ).toBe(true)
})
