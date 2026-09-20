import type { AiMessage } from './ai'
import { AI_LIMITS } from './ai'

// The boundary is explicit: repair prompts belong to the current user turn too.
export function budgetAiHistory(messages: AiMessage[], currentTurn: number) {
  let start = 0
  const fits = () =>
    messages.length - start <= AI_LIMITS.messages
    && new TextEncoder().encode(JSON.stringify(messages.slice(start))).length
    <= AI_LIMITS.inputBytes
  while (!fits() && start < currentTurn) {
    const next = messages.findIndex(
      (message, index) =>
        index > start && index <= currentTurn && message.role === 'user',
    )
    if (next < 0)
      break
    start = next
  }
  return { messages: messages.slice(start), omitted: start > 0, fits: fits() }
}
