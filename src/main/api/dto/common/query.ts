import { t } from 'elysia'

const Order = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const

export const commonQuery = t.Optional(
  t.Object({
    search: t.Optional(t.String()),
    sort: t.Optional(t.String()),
    order: t.Optional(t.Enum(Order)),
  }),
)
