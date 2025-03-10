import Elysia, { t } from 'elysia'
import { commonQuery } from './common/query'

const snippetsAdd = t.Object({
  name: t.String(),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
})

const snippetsUpdate = t.Object({
  ...snippetsAdd.properties,
  folderId: t.Union([t.Number(), t.Null()]),
  description: t.Union([t.String(), t.Null()]),
  isDeleted: t.Number({ minimum: 0, maximum: 1 }),
  isFavorites: t.Number({ minimum: 0, maximum: 1 }),
})

const snippetContentsAdd = t.Object({
  label: t.String(),
  value: t.Union([t.String(), t.Null()]),
  language: t.String(), // TODO: enum
})

const snippetItem = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  tags: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
    }),
  ),
  folder: t.Nullable(
    t.Object({
      id: t.Number(),
      name: t.String(),
    }),
  ),
  contents: t.Array(
    t.Object({
      id: t.Number(),
      label: t.String(),
      value: t.Union([t.String(), t.Null()]),
      language: t.String(),
    }),
  ),
  isFavorites: t.Number(),
  isDeleted: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
})

const snippetsResponse = t.Array(snippetItem)

export const snippetsDTO = new Elysia().model({
  snippetContentsAdd,
  snippetsAdd,
  snippetsUpdate,
  snippetsQuery: t.Object({
    ...commonQuery.properties,
    folderId: t.Optional(t.Number()),
    tagId: t.Optional(t.Number()),
    isFavorites: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    isDeleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    isInbox: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  }),
  snippetsResponse,
})

export type SnippetsAdd = typeof snippetsAdd.static
export type SnippetsResponse = typeof snippetsResponse.static
