import Elysia, { t } from 'elysia'

const tagsAdd = t.Object({
  name: t.String(),
})

export const tagsResponse = t.Object({
  id: t.Number(),
  name: t.String(),
})

export const tagsDTO = new Elysia().model({
  tagsAdd,
  tagsResponse,
})

export type TagsAdd = typeof tagsAdd.static
export type TagsResponse = typeof tagsResponse.static
