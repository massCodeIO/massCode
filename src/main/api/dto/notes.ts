import Elysia, { t } from 'elysia'
import { commonQuery } from './common/query'

const notesAdd = t.Object({
  name: t.String(),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
})

const notesUpdate = t.Object({
  name: t.Optional(t.String()),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  isDeleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  isFavorites: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
})

const notesContentUpdate = t.Object({
  content: t.String(),
})

const notesCountsResponse = t.Object({
  total: t.Number(),
  trash: t.Number(),
})

export const notesDTO = new Elysia().model({
  notesAdd,
  notesContentUpdate,
  notesCountsResponse,
  notesQuery: t.Object({
    ...commonQuery.properties,
    folderId: t.Optional(t.Number()),
    tagId: t.Optional(t.Number()),
    isFavorites: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    isDeleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    isInbox: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  }),
  notesUpdate,
})

export type NotesAdd = typeof notesAdd.static
export type NotesCountsResponse = typeof notesCountsResponse.static
