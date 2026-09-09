import Elysia, { t } from 'elysia'
import { httpRuntime } from './http-requests'

const entry = t.Object({
  key: t.String(),
  value: t.String(),
  enabled: t.Optional(t.Boolean()),
  description: t.Optional(t.String()),
})
const collectionConfig = t.Object({
  postResponseOrder: t.Optional(
    t.Union([t.Literal('parent-first'), t.Literal('child-first')]),
  ),
  documentation: t.String({ maxLength: 1048576 }),
  version: t.String({ maxLength: 256 }),
  headers: t.Array(entry, { maxItems: 1000 }),
  variables: t.Array(entry, { maxItems: 1000 }),
  auth: t.Object({
    type: t.Union([
      t.Literal('none'),
      t.Literal('inherit'),
      t.Literal('basic'),
      t.Literal('bearer'),
      t.Literal('apikey'),
    ]),
    key: t.Optional(t.String()),
    value: t.Optional(t.String()),
    in: t.Optional(t.Union([t.Literal('header'), t.Literal('query')])),
    token: t.Optional(t.String()),
    username: t.Optional(t.String()),
    password: t.Optional(t.String()),
  }),
  runtime: httpRuntime,
})

const httpFoldersAdd = t.Object({
  name: t.String(),
  icon: t.Optional(t.Union([t.String(), t.Null()])),
  parentId: t.Optional(t.Union([t.Number(), t.Null()])),
})

const httpFoldersUpdate = t.Object({
  collectionConfig: t.Optional(collectionConfig),
  name: t.Optional(t.String()),
  icon: t.Optional(t.Union([t.String(), t.Null()])),
  parentId: t.Optional(t.Union([t.Number(), t.Null()])),
  isOpen: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  orderIndex: t.Optional(t.Number()),
})

const httpFoldersItem = t.Object({
  collectionConfig: t.Optional(t.Union([collectionConfig, t.Null()])),
  collectionConfigState: t.Optional(
    t.Union([t.Literal('ready'), t.Literal('invalid')]),
  ),
  id: t.Number(),
  name: t.String(),
  icon: t.Union([t.String(), t.Null()]),
  createdAt: t.Number(),
  updatedAt: t.Number(),
  parentId: t.Union([t.Number(), t.Null()]),
  isOpen: t.Number(),
  orderIndex: t.Number(),
})

const httpFoldersItemWithChildren = t.Recursive(This =>
  t.Object({
    ...httpFoldersItem.properties,
    children: t.Array(This),
  }),
)

const httpFoldersResponse = t.Array(httpFoldersItem)
const httpFoldersTreeResponse = t.Array(httpFoldersItemWithChildren)

export const httpFoldersDTO = new Elysia().model({
  httpFoldersAdd,
  httpFoldersResponse,
  httpFoldersTreeResponse,
  httpFoldersUpdate,
})

export type HttpFoldersAdd = typeof httpFoldersAdd.static
export type HttpFoldersResponse = typeof httpFoldersResponse.static
export type HttpFoldersTree = typeof httpFoldersTreeResponse.static
export type HttpFoldersItem = typeof httpFoldersItem.static
