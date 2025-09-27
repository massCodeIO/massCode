import { t } from 'elysia'

export const commonAddResponse = t.Object({
  id: t.Union([t.Number(), t.BigInt()]),
})
