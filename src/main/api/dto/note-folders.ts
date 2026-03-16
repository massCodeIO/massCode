import Elysia, { t } from 'elysia'

const noteFoldersAdd = t.Object({
  name: t.String(),
  parentId: t.Optional(t.Union([t.Number(), t.Null()])),
})

const noteFoldersUpdate = t.Object({
  name: t.Optional(t.String()),
  icon: t.Optional(t.Union([t.String(), t.Null()])),
  parentId: t.Optional(t.Union([t.Number(), t.Null()])),
  isOpen: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  orderIndex: t.Optional(t.Number()),
})

const noteFoldersItem = t.Object({
  id: t.Number(),
  name: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
  icon: t.Union([t.String(), t.Null()]),
  parentId: t.Union([t.Number(), t.Null()]),
  isOpen: t.Number(),
  orderIndex: t.Number(),
})

const noteFoldersItemWithChildren = t.Recursive(This =>
  t.Object({
    ...noteFoldersItem.properties,
    children: t.Array(This),
  }),
)

const noteFoldersResponse = t.Array(noteFoldersItem)
const noteFoldersTreeResponse = t.Array(noteFoldersItemWithChildren)

export const noteFoldersDTO = new Elysia().model({
  noteFoldersAdd,
  noteFoldersResponse,
  noteFoldersTreeResponse,
  noteFoldersUpdate,
})

export type NoteFoldersAdd = typeof noteFoldersAdd.static
export type NoteFoldersResponse = typeof noteFoldersResponse.static
export type NoteFoldersTree = typeof noteFoldersTreeResponse.static
export type NoteFoldersItem = typeof noteFoldersItem.static
