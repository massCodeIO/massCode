import Elysia, { t } from 'elysia'

const httpEnvironmentVariables = t.Record(t.String(), t.String())

const httpEnvironmentsAdd = t.Object({
  name: t.String(),
  variables: t.Optional(httpEnvironmentVariables),
})

const httpEnvironmentsUpdate = t.Object({
  name: t.Optional(t.String()),
  variables: t.Optional(httpEnvironmentVariables),
})

const httpEnvironmentsSetActive = t.Object({
  id: t.Union([t.Number(), t.Null()]),
})

const httpEnvironmentItem = t.Object({
  id: t.Number(),
  name: t.String(),
  variables: httpEnvironmentVariables,
  createdAt: t.Number(),
  updatedAt: t.Number(),
})

const httpEnvironmentsResponse = t.Object({
  activeId: t.Union([t.Number(), t.Null()]),
  items: t.Array(httpEnvironmentItem),
})

export const httpEnvironmentsDTO = new Elysia().model({
  httpEnvironmentItemResponse: httpEnvironmentItem,
  httpEnvironmentsAdd,
  httpEnvironmentsResponse,
  httpEnvironmentsSetActive,
  httpEnvironmentsUpdate,
})

export type HttpEnvironmentsAdd = typeof httpEnvironmentsAdd.static
export type HttpEnvironmentsUpdate = typeof httpEnvironmentsUpdate.static
export type HttpEnvironmentsSetActive = typeof httpEnvironmentsSetActive.static
export type HttpEnvironmentsResponse = typeof httpEnvironmentsResponse.static
export type HttpEnvironmentItemResponse = typeof httpEnvironmentItem.static
