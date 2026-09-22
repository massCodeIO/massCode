import type { HttpExecutePayload, HttpExecuteResult } from '../main/types/http'
import type { WsConnect } from './httpWebSocket'
import { z } from 'zod'
import { workspaceFieldsSchema } from './aiWorkspace'
import { httpCollectionSchema } from './httpCollection'
import { httpRuntimeSchema } from './httpRuntime'
import { httpTransportSchema } from './httpTransport'
import { wsSendSchema } from './httpWebSocket'

const requestFields = workspaceFieldsSchema.pick({
  method: true,
  url: true,
  headers: true,
  query: true,
  bodyType: true,
  body: true,
  formData: true,
  auth: true,
})
export const aiHttpRequestSchema = requestFields
  .required()
  .extend({
    url: z.string(),
    body: z.string().nullable(),
    headers: z.array(httpCollectionSchema.shape.headers.element),
    query: z.array(httpCollectionSchema.shape.headers.element),
    formData: z.array(workspaceFieldsSchema.shape.formData.unwrap().element),
  })
  .strip()
export const aiHttpDraftSchema = z
  .object({
    contextId: z.uuid(),
    protocol: z.enum(['http', 'websocket']).optional(),
    savedFields: z
      .object({
        description: z.string(),
        folderId: z.number().int().positive().nullable(),
      })
      .optional(),
    requestId: z.number().int().positive(),
    environmentId: z.number().int().positive().nullable(),
    request: aiHttpRequestSchema,
    runtime: httpRuntimeSchema,
    transport: httpTransportSchema,
    skipCertificateVerification: z.boolean(),
  })
  .strict()
export type AiHttpDraft = z.infer<typeof aiHttpDraftSchema>
export const aiHttpCoreActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('send'),
      source: z.enum(['saved', 'draft']),
      requestId: z.number().int().positive(),
      summary: z.string().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal('patchDraft'),
      summary: z.string().min(1).max(2000),
      fields: requestFields
        .extend({ runtime: httpRuntimeSchema.optional() })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal('patchAndSend'),
      summary: z.string().min(1).max(2000),
      fields: requestFields
        .extend({ runtime: httpRuntimeSchema.optional() })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal('saveAndSend'),
      summary: z.string().min(1).max(2000),
      fields: requestFields
        .extend({ runtime: httpRuntimeSchema.optional() })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      action: z.enum(['saveDraft', 'discardDraft']),
      summary: z.string().min(1).max(2000),
    })
    .strict(),
])
const summary = z.string().min(1).max(2000)
export const aiHttpAuxActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('runCollection'),
      summary,
      folderId: z.number().int().positive(),
      requestIds: z.array(z.number().int().positive()).max(500).optional(),
      continueOnFailure: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal('connectWebSocket'),
      summary,
      source: z.enum(['saved', 'draft']),
      requestId: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal('sendWebSocket'),
      summary,
      connectionId: z.uuid(),
      text: wsSendSchema.shape.text,
    })
    .strict(),
  z
    .object({
      action: z.literal('clearWebSocket'),
      summary,
      connectionId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.enum([
        'clearHistory',
        'clearConsole',
        'clearSession',
        'clearCookies',
      ]),
      summary,
    })
    .strict(),
  z
    .object({
      action: z.literal('cookieCreate'),
      summary,
      domain: z.string().min(1).max(2048),
      raw: z.string().min(1).max(16384),
    })
    .strict(),
  z
    .object({
      action: z.literal('cookieMetadata'),
      summary,
      id: z.string().max(4096),
      fields: z
        .object({
          path: z.string().max(4096).optional(),
          secure: z.boolean().optional(),
          httpOnly: z.boolean().optional(),
          expires: z.string().datetime().nullable().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal('cookieDelete'),
      summary,
      id: z.string().max(4096),
    })
    .strict(),
  z
    .object({
      action: z.enum(['cookieDomainAdd', 'cookieDomainDelete']),
      summary,
      domain: z.string().min(1).max(2048),
    })
    .strict(),
  z
    .object({
      action: z.literal('cookiesEnabled'),
      summary,
      requestId: z.number().int().positive().nullable(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.enum(['protectVariable', 'unprotectVariable']),
      summary,
      environmentId: z.number().int().positive(),
      key: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal('scriptTrust'),
      summary,
      subject: z.enum(['request', 'collection']),
      id: z.number().int().positive(),
      allowed: z.boolean(),
    })
    .strict(),
])
export type AiHttpAuxAction = z.infer<typeof aiHttpAuxActionSchema>
export type AiHttpCoreAction = z.infer<typeof aiHttpCoreActionSchema>
export const aiHttpActionSchema = z.discriminatedUnion('action', [
  ...aiHttpCoreActionSchema.options,
  ...aiHttpAuxActionSchema.options,
])
export function isHttpAuxAction(
  action: AiHttpAction,
): action is AiHttpAuxAction {
  return ![
    'send',
    'patchDraft',
    'saveDraft',
    'discardDraft',
    'patchAndSend',
    'saveAndSend',
  ].includes(action.action)
}
export type AiHttpAction = z.infer<typeof aiHttpActionSchema>
export interface AiHttpActionView {
  id: string
  action: AiHttpAction['action']
  summary: string
  source: 'saved' | 'draft' | 'workspace'
  state: 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
  preview: unknown
  result?: unknown
}

// Trusted app/main result only; never part of provider events or tool results.
export interface AiHttpExecutionReceipt {
  payload: HttpExecutePayload
  requestCreatedAt: number
  vault: string
}
export type AiHttpResultConsumer = (
  execution: AiHttpExecutionReceipt,
  response: HttpExecuteResult,
) => boolean

export type AiHttpWebSocketReceipt = Pick<
  WsConnect,
  'connectionId' | 'requestId' | 'environmentId'
>

export interface AiHttpActionApplyResult {
  view: AiHttpActionView
  draftAction?: AiHttpCoreAction
  response?: HttpExecuteResult
  execution?: AiHttpExecutionReceipt
  webSocket?: AiHttpWebSocketReceipt
}
