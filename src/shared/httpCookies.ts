import { z } from 'zod'

export const cookieDomainSchema = z.object({
  domain: z.string().trim().min(1).max(2048),
})
export const cookieSaveSchema = cookieDomainSchema.extend({
  raw: z.string().min(1).max(16384),
  originalId: z.string().max(4096).optional(),
})
export const cookieIdSchema = z.object({ id: z.string().max(4096) })
export const cookieRequestSchema = z.object({
  requestId: z.number().int().positive().nullable(),
})
export const cookieEnabledSchema = cookieRequestSchema.extend({
  enabled: z.boolean(),
})
export interface HttpCookie {
  id: string
  domain: string
  name: string
  value: string
  path: string
  raw: string
  expires: string | null
  secure: boolean
  httpOnly: boolean
  hostOnly: boolean
}
export interface HttpCookieSnapshot {
  domains: string[]
  cookies: HttpCookie[]
  enabled: boolean
}

export const cookiePreviewSchema = cookieRequestSchema.extend({
  url: z.string().max(65536),
})
