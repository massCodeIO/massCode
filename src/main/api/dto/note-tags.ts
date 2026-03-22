import Elysia, { t } from 'elysia'

const noteTagsAdd = t.Object({
  name: t.String(),
})

const noteTagsUpdate = t.Object({
  name: t.String(),
})

const noteTagsItem = t.Object({
  id: t.Number(),
  name: t.String(),
})

export const noteTagsResponse = t.Array(noteTagsItem)
export const noteTagsAddResponse = t.Object({
  id: t.Number(),
})

export const noteTagsDTO = new Elysia().model({
  noteTagsAdd,
  noteTagsAddResponse,
  noteTagsResponse,
  noteTagsUpdate,
})

export type NoteTagsAdd = typeof noteTagsAdd.static
export type NoteTagsResponse = typeof noteTagsResponse.static
