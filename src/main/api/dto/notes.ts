import Elysia, { t } from 'elysia'
import { commonQuery } from './common/query'

const notesAdd = t.Object({
  name: t.String(),
  folderId: t.Optional(t.Union([t.Number(), t.Null()])),
  properties: t.Optional(t.Record(t.String(), t.Any())),
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

const noteProperties = t.Record(t.String(), t.Any())

const notePropertiesUpdate = t.Object({
  properties: t.Optional(noteProperties),
  unset: t.Optional(t.Array(t.String())),
})

const noteItemBase = {
  id: t.Number(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  properties: noteProperties,
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
  isFavorites: t.Number(),
  isDeleted: t.Number(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
}

const noteItem = t.Object({
  ...noteItemBase,
  content: t.String(),
})

// Список не содержит контента заметок: контент выбранной заметки
// загружается отдельным GET /notes/:id.
const noteListItem = t.Object(noteItemBase)

const notesResponse = t.Array(noteListItem)

const notesCountsResponse = t.Object({
  total: t.Number(),
  trash: t.Number(),
})

export const notesDTO = new Elysia().model({
  notesAdd,
  notesContentUpdate,
  notesCountsResponse,
  noteItemResponse: noteItem,
  noteProperties,
  notesResponse,
  notesQuery: t.Object({
    ...commonQuery.properties,
    searchNameOnly: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    folderId: t.Optional(t.Number()),
    tagId: t.Optional(t.Number()),
    isFavorites: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    isDeleted: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    isInbox: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
    propertyDue: t.Optional(
      t.Union([t.Literal('today'), t.Literal('upcoming')]),
    ),
    propertyStatus: t.Optional(t.String()),
    propertyStatusNot: t.Optional(t.String()),
    propertyType: t.Optional(t.String()),
  }),
  notePropertiesUpdate,
  notesUpdate,
})

export type NotesAdd = typeof notesAdd.static
export type NotesResponse = typeof notesResponse.static
export type NoteListItemResponse = typeof noteListItem.static
export type NotesCountsResponse = typeof notesCountsResponse.static
export type NoteItemResponse = typeof noteItem.static
