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
export const aiMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(AI_LIMITS.inputBytes),
  })
  .strict()
export type AiMessage = z.infer<typeof aiMessageSchema>
export const aiStartSchema = z
  .object({
    requestId: z.uuid(),
    messages: z.array(aiMessageSchema).min(1).max(AI_LIMITS.messages),
  })
  .strict()
  .refine(value => value.messages.at(-1)?.role === 'user')
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
  | 'authentication'
  | 'rateLimit'
  | 'modelUnavailable'
  | 'upstream'
  | 'invalidResponse'
  | 'inputLimit'
  | 'outputLimit'
  | 'timeout'
export type AiResult<T> =
  | { ok: true, data: T }
  | { ok: false, error: AiErrorCode }
export type AiEvent =
  | { requestId: string, type: 'delta', text: string }
  | { requestId: string, type: 'done' | 'cancelled' }
  | { requestId: string, type: 'error', error: AiErrorCode }
