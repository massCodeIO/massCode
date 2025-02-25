import Elysia, { t } from 'elysia'

const foldersAdd = t.Object({
  name: t.String(),
})

const foldersUpdate = t.Object({
  name: t.String(),
  icon: t.Union([t.String(), t.Null()]),
  defaultLanguage: t.String(),
  parentId: t.Union([t.Number(), t.Null()]),
  isOpen: t.Number({ minimum: 0, maximum: 1 }),
  orderIndex: t.Number(),
})

const foldersItem = t.Object({
  id: t.Number(),
  name: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
  icon: t.Union([t.String(), t.Null()]),
  parentId: t.Union([t.Number(), t.Null()]),
  isOpen: t.Number(),
  defaultLanguage: t.String(),
  orderIndex: t.Number(),
})

const foldersItemWithChildren = t.Object({
  ...foldersItem.properties,
  children: t.Array(foldersItem),
})

const foldersResponse = t.Array(foldersItem)
const foldersTreeResponse = t.Array(foldersItemWithChildren)

export const foldersDTO = new Elysia().model({
  foldersAdd,
  foldersResponse,
  foldersUpdate,
  foldersTreeResponse,
})

export type FoldersAdd = typeof foldersAdd.static
export type FoldersResponse = typeof foldersResponse.static
export type FoldersTree = typeof foldersTreeResponse.static
