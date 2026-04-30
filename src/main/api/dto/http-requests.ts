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

const httpBodyType = t.Union([
  t.Literal('none'),
  t.Literal('json'),
  t.Literal('text'),
  t.Literal('form-urlencoded'),
  t.Literal('multipart'),
])

const httpAuthType = t.Union([
  t.Literal('none'),
  t.Literal('bearer'),
  t.Literal('basic'),
])

const httpHeaderEntry = t.Object({
  key: t.String(),
  value: t.String(),
})

const httpQueryEntry = t.Object({
  key: t.String(),
  value: t.String(),
})

const httpFormDataEntry = t.Object({
  key: t.String(),
  type: t.Union([t.Literal('text'), t.Literal('file')]),
  value: t.String(),
})

const httpAuth = t.Object({
  type: httpAuthType,
  token: t.Optional(t.String()),
  username: t.Optional(t.String()),
  password: t.Optional(t.String()),
})

const httpRequestsAdd = t.Object({
  name: t.String(),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  method: t.Optional(httpMethod),
  url: t.Optional(t.String()),
})

const httpRequestsUpdate = t.Object({
  name: t.Optional(t.String()),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  method: t.Optional(httpMethod),
  url: t.Optional(t.String()),
  headers: t.Optional(t.Array(httpHeaderEntry)),
  query: t.Optional(t.Array(httpQueryEntry)),
  bodyType: t.Optional(httpBodyType),
  body: t.Optional(t.Union([t.String(), t.Null()])),
  formData: t.Optional(t.Array(httpFormDataEntry)),
  auth: t.Optional(httpAuth),
  description: t.Optional(t.String()),
})

const httpRequestItem = t.Object({
  id: t.Number(),
  name: t.String(),
  folderId: t.Union([t.Number(), t.Null()]),
  method: httpMethod,
  url: t.String(),
  headers: t.Array(httpHeaderEntry),
  query: t.Array(httpQueryEntry),
  bodyType: httpBodyType,
  body: t.Union([t.String(), t.Null()]),
  formData: t.Array(httpFormDataEntry),
  auth: httpAuth,
  description: t.String(),
  filePath: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
})

const httpRequestsResponse = t.Array(httpRequestItem)

export const httpRequestsDTO = new Elysia().model({
  httpRequestItemResponse: httpRequestItem,
  httpRequestsAdd,
  httpRequestsResponse,
  httpRequestsUpdate,
})

export type HttpRequestsAdd = typeof httpRequestsAdd.static
export type HttpRequestsUpdate = typeof httpRequestsUpdate.static
export type HttpRequestsResponse = typeof httpRequestsResponse.static
export type HttpRequestItemResponse = typeof httpRequestItem.static
