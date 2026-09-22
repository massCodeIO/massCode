import type { ChatMessage } from './useAi'

// Receipts retain historical facts; links reflect the latest applied local action.
export function unavailableWorkspaceItems(messages: ChatMessage[]) {
  const unavailable = new Set<string>()
  for (const message of messages) {
    for (const creation of message.workspaceCreations ?? []) {
      for (const item of creation.items) {
        const key = `${item.type}:${item.id}`
        if (creation.undone.includes(item.operationIndex))
          unavailable.add(key)
        else unavailable.delete(key)
      }
    }
    for (const [index, change] of (
      message.workspaceProposal?.changes ?? []
    ).entries()) {
      const undone = message.workspaceUndone?.includes(index)
      if (!message.workspaceApplied?.includes(index) && !undone)
        continue
      const op = change.operation
      const type
        = op.space === 'code'
          ? 'snippet'
          : op.space === 'notes'
            ? 'note'
            : 'http_request'
      const before = JSON.parse(change.before)
      if (op.kind === 'folder' && op.action === 'delete') {
        for (const item of before.affectedItems ?? [])
          unavailable.add(`${type}:${item.id}`)
      }
      if (op.kind !== 'item')
        continue
      const deleted = undone
        ? (before.record?.isDeleted ?? before.isDeleted)
        : op.action === 'trash' || op.action === 'permanentDelete'
          ? 1
          : op.action === 'restore'
            ? 0
            : op.fields.isDeleted
      if (deleted === undefined)
        continue
      if (deleted)
        unavailable.add(`${type}:${op.id}`)
      else unavailable.delete(`${type}:${op.id}`)
    }
  }
  return unavailable
}
