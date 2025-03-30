import Elysia, { t } from 'elysia'

const tagsAdd = t.Object({
  name: t.String(),
})

const tagsItem = t.Object({
  id: t.Number(),
  name: t.String(),
})

export const tagsResponse = t.Array(tagsItem)
export const tagsAddResponse = t.Object({
  id: t.Number(),
})

export const tagsDTO = new Elysia().model({
  tagsAdd,
  tagsResponse,
  tagsAddResponse,
})

export type TagsAdd = typeof tagsAdd.static
export type TagsResponse = typeof tagsResponse.static
