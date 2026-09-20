import { z } from 'zod'

export const aiProviderSchema = z.enum(['openai', 'ollama', 'lmstudio'])
export type AiProvider = z.infer<typeof aiProviderSchema>
export const AI_DEFAULT_URLS: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
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
  })
  .strict()
  .refine((message) => {
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
export const aiStartSchema = z
  .object({
    requestId: z.uuid(),
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
}
export interface AiSettings {
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
  | 'explanation'
  | 'inputLimit'
  | 'outputLimit'
  | 'timeout'
export type AiResult<T> =
  | { ok: true, data: T }
  | { ok: false, error: AiErrorCode }
export type AiEvent =
  | { requestId: string, type: 'delta', text: string }
  | { requestId: string, type: 'activity', name: string, detail: string }
  | { requestId: string, type: 'tools', calls: AiToolCall[] }
  | { requestId: string, type: 'protocol', messages: AiMessage[] }
  | { requestId: string, type: 'notice', error: AiErrorCode }
  | { requestId: string, type: 'historyOmitted' }
  | { requestId: string, type: 'done' | 'cancelled' }
  | { requestId: string, type: 'error', error: AiErrorCode }
