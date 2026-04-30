import Elysia, { t } from 'elysia'

const httpFoldersAdd = t.Object({
  name: t.String(),
  parentId: t.Optional(t.Union([t.Number(), t.Null()])),
})

const httpFoldersUpdate = t.Object({
  name: t.Optional(t.String()),
  parentId: t.Optional(t.Union([t.Number(), t.Null()])),
  isOpen: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  orderIndex: t.Optional(t.Number()),
})

const httpFoldersItem = t.Object({
  id: t.Number(),
  name: t.String(),
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
