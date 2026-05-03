import Elysia, { t } from 'elysia'

const httpMethod = t.Union([
  t.Literal('GET'),
  t.Literal('POST'),
  t.Literal('PUT'),
  t.Literal('PATCH'),
  t.Literal('DELETE'),
  t.Literal('HEAD'),
  t.Literal('OPTIONS'),
])

const httpHistoryItem = t.Object({
  id: t.Number(),
  requestId: t.Union([t.Number(), t.Null()]),
  method: httpMethod,
  url: t.String(),
  status: t.Union([t.Number(), t.Null()]),
  durationMs: t.Number(),
  sizeBytes: t.Number(),
  requestedAt: t.Number(),
  error: t.Optional(t.String()),
})

const httpHistoryResponse = t.Array(httpHistoryItem)

export const httpHistoryDTO = new Elysia().model({
  httpHistoryItemResponse: httpHistoryItem,
  httpHistoryResponse,
})

export type HttpHistoryResponse = typeof httpHistoryResponse.static
export type HttpHistoryItemResponse = typeof httpHistoryItem.static
