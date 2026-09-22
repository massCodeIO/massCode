import type { AiDataAction } from './aiDataActions'
import type { AiHttpProposal } from './aiHttp'
import type { AiHttpActionView } from './aiHttpActions'
import type {
  WorkspaceContainer,
  WorkspaceItem,
  WorkspaceProposal,
} from './aiWorkspace'
import { z } from 'zod'
import { aiHttpContextSchema } from './aiHttp'
import { aiHttpDraftSchema } from './aiHttpActions'
import { aiResponseReplaySchema } from './aiResponses'
import { aiSdkReplaySchema } from './aiSdkReplay'

export const aiProviderSchema = z.enum([
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'mistral',
  'xai',
  'ollama',
  'lmstudio',
])
export type AiProvider = z.infer<typeof aiProviderSchema>
export const AI_DEFAULT_URLS: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  xai: 'https://api.x.ai/v1',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
}
export const AI_PROVIDERS = aiProviderSchema.options
export function isLocalAiProvider(provider: AiProvider) {
  return provider === 'ollama' || provider === 'lmstudio'
}
export const AI_LIMITS = {
  messages: 40,
  inputBytes: 256 * 1024,
  outputBytes: 1024 * 1024,
  eventBytes: 256 * 1024,
  timeoutMs: 10 * 60 * 1000,
} as const

export const aiConfigureSchema = z
  .object({
    provider: aiProviderSchema,
    baseURL: z.string().max(2048),
    model: z.string().trim().max(256),
    apiKey: z.string().trim().min(1).max(8192).nullable().optional(),
    userInstructions: z.string().trim().max(4000).optional(),
  })
  .strict()
export type AiConfigure = z.infer<typeof aiConfigureSchema>
export const aiProposalSchema = z
  .object({
    context_id: z.string().uuid(),
    summary: z.string().min(1).max(2000),
    edits: z
      .array(
        z
          .object({
            old_text: z.string().min(1).max(AI_LIMITS.inputBytes),
            new_text: z.string().max(AI_LIMITS.inputBytes),
          })
          .strict(),
      )
      .min(1)
      .max(64),
  })
  .strict()
export type AiProposal = z.infer<typeof aiProposalSchema>
export const aiToolCallSchema = z
  .object({
    id: z.string().min(1).max(256),
    type: z.literal('function'),
    function: z
      .object({
        name: z.literal('propose_edit'),
        arguments: z.string().max(AI_LIMITS.outputBytes),
      })
      .strict(),
  })
  .strict()
export type AiToolCall = z.infer<typeof aiToolCallSchema>
export const aiProtocolCallSchema = aiToolCallSchema.extend({
  function: z
    .object({
      name: z.string().min(1).max(256),
      arguments: z.string().max(AI_LIMITS.outputBytes),
    })
    .strict(),
})
export type AiProtocolCall = z.infer<typeof aiProtocolCallSchema>
export const aiMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.string().max(AI_LIMITS.inputBytes),
    tool_calls: z.array(aiProtocolCallSchema).min(1).max(8).optional(),
    tool_call_id: z.string().min(1).max(256).optional(),
    openaiResponse: aiResponseReplaySchema.optional(),
    sdkResponse: aiSdkReplaySchema.optional(),
  })
  .strict()
  .refine((message) => {
    if (message.sdkResponse) {
      if (message.role !== 'assistant' || message.openaiResponse)
        return false
      const calls = message.sdkResponse.content.filter(
        part => part.type === 'tool-call',
      )
      if (
        JSON.stringify(
          calls.map(call => [call.toolCallId, call.toolName, call.input]),
        )
        !== JSON.stringify(
          (message.tool_calls ?? []).map((call) => {
            try {
              return [
                call.id,
                call.function.name,
                JSON.parse(call.function.arguments),
              ]
            }
            catch {
              return null
            }
          }),
        )
      ) {
        return false
      }
    }
    if (message.openaiResponse) {
      if (message.role !== 'assistant')
        return false
      const calls = message.openaiResponse.items.filter(
        item => item.type === 'function_call',
      )
      if (
        JSON.stringify(
          calls.map(call => [call.call_id, call.name, call.arguments]),
        )
        !== JSON.stringify(
          (message.tool_calls ?? []).map(call => [
            call.id,
            call.function.name,
            call.function.arguments,
          ]),
        )
      ) {
        return false
      }
    }
    if (message.role === 'user') {
      return (
        Boolean(message.content) && !message.tool_calls && !message.tool_call_id
      )
    }
    if (message.role === 'tool') {
      return (
        Boolean(message.content && message.tool_call_id) && !message.tool_calls
      )
    }
    return (
      Boolean(message.content || message.tool_calls) && !message.tool_call_id
    )
  })
export type AiMessage = z.infer<typeof aiMessageSchema>
export const aiVaultRefSchema = z
  .object({
    type: z.enum(['snippet', 'note', 'http_request']),
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
export type AiVaultRef = z.infer<typeof aiVaultRefSchema>
export type AiVaultItem = AiVaultRef & { name: string }
export interface AiSearchResults {
  queries: string[]
  items: (AiVaultItem & { method?: string, url?: string })[]
  total: number
  expanded: boolean
}
export const aiWorkspaceContextSchema = z
  .object({
    space: z.enum(['code', 'notes', 'http']),
    selectedIds: z.array(z.number().int().positive()).max(500),
    folderId: z.number().int().positive().nullable().optional(),
    library: z.string().max(80).optional(),
  })
  .strict()
export type AiWorkspaceContext = z.infer<typeof aiWorkspaceContextSchema>
export const aiStartSchema = z
  .object({
    requestId: z.uuid(),
    workspaceContext: aiWorkspaceContextSchema.optional(),
    httpContext: aiHttpContextSchema.optional(),
    httpDraft: aiHttpDraftSchema.optional(),
    userMessages: z
      .array(z.string().max(AI_LIMITS.inputBytes))
      .max(AI_LIMITS.messages)
      .optional(),
    attachments: z.array(aiVaultRefSchema).max(8).optional(),
    vaultAccess: z.boolean().optional(),
    editContextId: z.uuid().optional(),
    editContextText: z.string().min(1).max(AI_LIMITS.inputBytes).optional(),
    messages: z.array(aiMessageSchema).min(1).max(AI_LIMITS.messages),
  })
  .strict()
  .refine(
    value =>
      Boolean(value.editContextId) === (value.editContextText !== undefined),
  )
  .refine(
    value =>
      !value.httpDraft
      || (value.httpDraft.requestId === value.httpContext?.requestId
        && value.httpDraft.contextId === value.httpContext?.contextId),
  )
  .refine(value => value.messages.at(-1)?.role === 'user')
  .refine((value) => {
    const pending = new Set<string>()
    for (const message of value.messages) {
      if (message.role === 'tool') {
        if (!pending.delete(message.tool_call_id!))
          return false
        continue
      }
      if (pending.size)
        return false
      for (const call of message.tool_calls ?? []) {
        if (pending.has(call.id))
          return false
        pending.add(call.id)
      }
    }
    return pending.size === 0
  })
export const aiCancelSchema = z.object({ requestId: z.uuid() }).strict()
export type AiStart = z.infer<typeof aiStartSchema>
export interface AiProfile {
  baseURL: string
  model: string
  hasKey: boolean
  hasStoredKey: boolean
  models?: string[]
  keyPreview?: string
}
export interface AiSettings {
  userInstructions?: string
  provider: AiProvider
  profiles: Record<AiProvider, AiProfile>
  encryptionAvailable: boolean
}
export type AiErrorCode =
  | 'invalidRequest'
  | 'unauthorized'
  | 'encryptionUnavailable'
  | 'keyUnavailable'
  | 'notConfigured'
  | 'busy'
  | 'connection'
  | 'contextUnavailable'
  | 'authentication'
  | 'rateLimit'
  | 'modelUnavailable'
  | 'upstream'
  | 'invalidResponse'
  | 'invalidEdits'
  | 'proposalUnavailable'
  | 'explanation'
  | 'inputLimit'
  | 'outputLimit'
  | 'timeout'
export type AiResult<T> =
  | { ok: true, data: T }
  | { ok: false, error: AiErrorCode }
export type AiEvent =
  | {
    requestId: string
    type: 'workspaceProposal'
    proposal: WorkspaceProposal
    applied?: number[]
    items?: WorkspaceItem[]
    containers?: WorkspaceContainer[]
    failedOperationIndex?: number
  }
  | { requestId: string, type: 'dataAction', action: AiDataAction }
  | { requestId: string, type: 'httpAction', action: AiHttpActionView }
  | { requestId: string, type: 'httpProposal', proposal: AiHttpProposal }
  | { requestId: string, type: 'answerReset' }
  | { requestId: string, type: 'searchResults', result: AiSearchResults }
  | { requestId: string, type: 'delta', text: string }
  | { requestId: string, type: 'activity', name: string, detail: string }
  | { requestId: string, type: 'tools', calls: AiToolCall[] }
  | { requestId: string, type: 'protocol', messages: AiMessage[] }
  | { requestId: string, type: 'notice', error: AiErrorCode }
  | { requestId: string, type: 'historyOmitted' }
  | { requestId: string, type: 'done' | 'cancelled' }
  | {
    requestId: string
    type: 'error'
    error: AiErrorCode
    diagnostic?: string
  }
