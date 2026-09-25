import type {
  AiContext,
  ChatMessage,
} from '../../../src/renderer/composables/ai/useAi'
import type {
  AiErrorCode,
  AiVaultItem,
  AiWorkspaceContext,
} from '../../../src/shared/ai'

export interface CapturedContext {
  editor?: AiContext
  mode: 'none' | 'selection' | 'fragment'
  attachments: AiVaultItem[]
  workspace?: AiWorkspaceContext
}
export interface DemoConversation {
  messages: ChatMessage[]
  draft?: string
  queue?: { id: string, prompt: string, context: CapturedContext }[]
  historyOmitted?: boolean
  error?: AiErrorCode
  diagnostic?: string
}
export interface Scenario {
  id: string
  group: string
  title: string
  description: string
  conversation: DemoConversation
  streaming?: boolean
  historyOmitted?: boolean
  error?: AiErrorCode
  diagnostic?: string
  stale?: boolean
  dirty?: boolean
  configured?: boolean
  composer?: CapturedContext
  search?: 'normal' | 'loading' | 'empty' | 'error'
  animate?: boolean
  retryOnOpen?: boolean
}
