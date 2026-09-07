import type { HttpRuntime } from './httpRuntime'
import { z } from 'zod'
import { emptyHttpRuntime, httpRuntimeSchema } from './httpRuntime'

const entry = z.object({
  key: z.string().max(8192),
  value: z.string().max(32768),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
})
export const httpCollectionSchema = z
  .object({
    documentation: z.string().max(1048576),
    version: z.string().max(256),
    headers: z.array(entry).max(1000),
    variables: z
      .array(entry)
      .max(1000)
      .superRefine((entries, ctx) => {
        const names = new Set<string>()
        entries.forEach((entry, index) => {
          if (entry.enabled === false)
            return
          if (
            !/^(?!__proto__$|constructor$|prototype$)[\w.-]{1,128}$/u.test(
              entry.key,
            )
            || names.has(entry.key)
          ) {
            ctx.addIssue({
              code: 'custom',
              path: [index, 'key'],
              message: 'variableName',
            })
          }
          names.add(entry.key)
        })
      }),
    auth: z.object({
      type: z.enum(['none', 'bearer', 'basic']),
      token: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }),
    runtime: httpRuntimeSchema,
  })
  .strict()
export type HttpCollectionConfig = z.infer<typeof httpCollectionSchema>
export function emptyHttpCollection(): HttpCollectionConfig {
  return {
    documentation: '',
    version: '',
    headers: [],
    variables: [],
    auth: { type: 'none' },
    runtime: emptyHttpRuntime(),
  }
}

interface CollectionFolder {
  id: number
  parentId: number | null
  collectionConfig?: unknown
  collectionConfigState?: string
}
export function findHttpCollection<T extends CollectionFolder>(
  folders: T[],
  folderId: number | null | undefined,
): T | undefined {
  if (folderId == null)
    return undefined
  const visited = new Set<number>()
  let folder = folders.find(item => item.id === folderId)
  while (folder) {
    if (visited.has(folder.id))
      throw new Error('HTTP_COLLECTION_INVALID')
    visited.add(folder.id)
    if (folder.parentId === null)
      return folder
    if (
      folder.collectionConfig !== undefined
      && folder.collectionConfig !== null
    ) {
      throw new Error('HTTP_COLLECTION_INVALID')
    }
    folder = folders.find(item => item.id === folder!.parentId)
  }
  throw new Error('HTTP_COLLECTION_INVALID')
}
export function readHttpCollection(
  folder?: CollectionFolder,
): HttpCollectionConfig | undefined {
  if (!folder)
    return undefined
  if (folder.collectionConfigState === 'invalid')
    throw new Error('HTTP_COLLECTION_INVALID')
  if (folder.collectionConfig === undefined)
    return undefined
  const parsed = httpCollectionSchema.safeParse(folder.collectionConfig)
  if (!parsed.success)
    throw new Error('HTTP_COLLECTION_INVALID')
  return parsed.data
}
export function collectionVariables(
  config?: HttpCollectionConfig,
): Record<string, string> {
  return Object.fromEntries(
    (config?.variables ?? [])
      .filter(entry => entry.enabled !== false && entry.key)
      .map(entry => [entry.key, entry.value]),
  )
}

interface RequestSettings {
  headers: {
    key: string
    value: string
    enabled?: boolean
    description?: string
  }[]
  auth: {
    type: 'none' | 'inherit' | 'basic' | 'bearer'
    token?: string
    username?: string
    password?: string
  }
}
export function applyHttpCollection<T extends RequestSettings>(
  request: T,
  config?: HttpCollectionConfig,
): T {
  const headers = new Map<string, T['headers'][number]>()
  for (const entry of [...(config?.headers ?? []), ...request.headers]) {
    if (entry.enabled !== false && entry.key)
      headers.set(entry.key.toLowerCase(), { ...entry })
  }
  return {
    ...request,
    headers: [...headers.values()],
    auth:
      request.auth.type === 'inherit'
        ? { ...(config?.auth ?? { type: 'none' }) }
        : { ...request.auth },
  }
}
export function mergeHttpCollectionRuntime(
  request: HttpRuntime,
  collection?: HttpRuntime,
): HttpRuntime {
  if (!collection)
    return request
  const names = new Set(request.extractions.map(rule => rule.name))
  const extractions = [
    ...collection.extractions.filter(rule => !names.has(rule.name)),
    ...request.extractions,
  ]
  const assertions = [...collection.assertions, ...request.assertions]
  if (assertions.length > 100 || extractions.length > 100)
    throw new Error('HTTP_COLLECTION_RULE_LIMIT')
  return { ...request, extractions, assertions }
}
