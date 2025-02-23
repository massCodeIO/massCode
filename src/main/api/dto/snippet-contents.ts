import Elysia, { t } from 'elysia'

const snippetContentsAdd = t.Object({
  snippetId: t.Number(),
  label: t.Union([t.String(), t.Null()]),
  value: t.Union([t.String(), t.Null()]),
  language: t.String(),
})

export const snippetContentsDTO = new Elysia().model({
  snippetContentsAdd,
})

export type SnippetContentsAdd = typeof snippetContentsAdd.static
