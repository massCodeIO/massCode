import { z } from 'zod'

export const WS_MESSAGE_LIMIT = 1024 * 1024
export const WS_LOG_LIMIT = 100
export const WS_PREVIEW_LIMIT = 16 * 1024
const entry = z.object({
  key: z.string().max(8192),
  value: z.string().max(32768),
  enabled: z.boolean().optional(),
})
export const wsConnectSchema = z.object({
  connectionId: z.string().uuid(),
  requestId: z.number().int().positive(),
  environmentId: z.number().int().positive().nullable(),
  url: z.string().min(1).max(32768),
  headers: z.array(entry).max(1000),
  query: z.array(entry).max(1000),
  auth: z.object({
    type: z.enum(['inherit', 'none', 'basic', 'bearer']),
    token: z.string().max(32768).optional(),
    username: z.string().max(8192).optional(),
    password: z.string().max(32768).optional(),
  }),
  skipCertificateVerification: z.boolean().optional(),
})
export const wsIdSchema = z.object({ connectionId: z.string().uuid() })
export const wsReadSchema = wsIdSchema.extend({
  after: z.number().int().nonnegative(),
})
export const wsSendSchema = wsIdSchema.extend({
  text: z.string().max(WS_MESSAGE_LIMIT),
})
export type WsConnect = z.infer<typeof wsConnectSchema>
export type WsState = 'connecting' | 'open' | 'closing' | 'closed' | 'error'
export type WsError =
  | 'invalid'
  | 'unavailable'
  | 'contextChanged'
  | 'network'
  | 'handshake'
  | 'tooLarge'
  | 'notOpen'
  | 'busy'
export interface WsMessage {
  id: number
  time: number
  direction: 'incoming' | 'outgoing'
  kind: 'text' | 'binary'
  text: string
  bytes: number
  truncated: boolean
}
export interface WsView {
  connectionId: string
  state: WsState
  messages: WsMessage[]
  dropped: number
  lastId: number
  closeCode?: number
  handshakeStatus?: number
  error?: WsError
}
