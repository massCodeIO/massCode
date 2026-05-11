import Elysia, { t } from 'elysia'

const captureTarget = t.Union([
  t.Literal('code'),
  t.Literal('notes'),
  t.Literal('http'),
])

const captureHttpMethod = t.Union([
  t.Literal('GET'),
  t.Literal('POST'),
  t.Literal('PUT'),
  t.Literal('PATCH'),
  t.Literal('DELETE'),
])

const captureSource = t.Object({
  title: t.Optional(t.String()),
  url: t.Optional(t.String()),
  capturedAt: t.Optional(t.Number()),
})

const captureRequest = t.Object({
  target: captureTarget,
  name: t.Optional(t.String()),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  text: t.Optional(t.String()),
  url: t.Optional(t.String()),
  pageTitle: t.Optional(t.String()),
  language: t.Optional(t.String()),
  method: t.Optional(captureHttpMethod),
  source: t.Optional(captureSource),
})

const captureResponse = t.Object({
  target: captureTarget,
  id: t.Number(),
})

export const capturesDTO = new Elysia().model({
  captureRequest,
  captureResponse,
})

export type CaptureRequest = typeof captureRequest.static
export type CaptureResponse = typeof captureResponse.static
