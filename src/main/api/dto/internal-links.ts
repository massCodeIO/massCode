import Elysia, { t } from 'elysia'

const internalLinksResolveBody = t.Object({
  titles: t.Array(t.String(), { maxItems: 500 }),
})

const resolvedInternalLinkEntity = t.Object({
  type: t.Union([
    t.Literal('snippet'),
    t.Literal('note'),
    t.Literal('http-request'),
  ]),
  id: t.Number(),
  name: t.String(),
  folder: t.Nullable(
    t.Object({
      id: t.Number(),
      name: t.String(),
    }),
  ),
  isDeleted: t.Number(),
  firstContent: t.Optional(
    t.Nullable(
      t.Object({
        language: t.String(),
        value: t.Union([t.String(), t.Null()]),
      }),
    ),
  ),
  contentExcerpt: t.Optional(t.String()),
  request: t.Optional(
    t.Object({
      method: t.String(),
      url: t.String(),
      description: t.String(),
    }),
  ),
})

const internalLinksResolveResponse = t.Array(
  t.Object({
    title: t.String(),
    resolved: t.Nullable(resolvedInternalLinkEntity),
  }),
)

export const internalLinksDTO = new Elysia().model({
  internalLinksResolveBody,
  internalLinksResolveResponse,
})

export type InternalLinksResolveResponse =
  typeof internalLinksResolveResponse.static
