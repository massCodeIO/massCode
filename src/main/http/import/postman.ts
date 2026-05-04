import type { HttpAuth, HttpHeaderEntry } from '../../types/http'
import type {
  HttpImportCollection,
  HttpImportEnvironment,
  HttpImportFile,
  HttpImportFolder,
  HttpImportRequest,
  HttpImportResult,
  HttpImportWarning,
} from './types'
import {
  addWarning,
  createEmptyRequestParts,
  normalizeEntries,
  normalizeHttpMethod,
  normalizeImportName,
  resolveAuthConflict,
  splitUrlAndQuery,
} from './normalize'

type UnknownRecord = Record<string, unknown>

interface PostmanContext {
  auth: HttpAuth
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readJsonFile(file: HttpImportFile, warnings: HttpImportWarning[]) {
  try {
    return JSON.parse(file.content) as unknown
  }
  catch {
    addWarning(warnings, file.name, 'Invalid JSON skipped')
    return null
  }
}

function isJsonFile(file: HttpImportFile): boolean {
  return file.name.toLowerCase().endsWith('.json')
}

function isPostmanCollection(value: unknown): value is UnknownRecord {
  if (!isRecord(value) || !isRecord(value.info)) {
    return false
  }

  const schema = asString(value.info.schema).toLowerCase()
  return schema.includes('postman') && Array.isArray(value.item)
}

function isPostmanEnvironment(value: unknown): value is UnknownRecord {
  return (
    isRecord(value)
    && Array.isArray(value.values)
    && (!isRecord(value.info) || !Array.isArray(value.item))
  )
}

function isOpenApiDocument(value: unknown): boolean {
  return (
    isRecord(value)
    && isRecord(value.paths)
    && (typeof value.openapi === 'string' || typeof value.swagger === 'string')
  )
}

function getKeyValueArrayValue(
  value: unknown,
  key: string,
): string | undefined {
  for (const entry of asArray(value)) {
    if (!isRecord(entry)) {
      continue
    }

    if (entry.key === key && typeof entry.value === 'string') {
      return entry.value
    }
  }

  return undefined
}

function parseAuth(
  rawAuth: unknown,
  source: string,
  warnings: HttpImportWarning[],
): HttpAuth | null {
  if (!isRecord(rawAuth)) {
    return null
  }

  const type = asString(rawAuth.type).toLowerCase()
  if (!type || type === 'noauth') {
    return { type: 'none' }
  }

  if (type === 'bearer') {
    const token = getKeyValueArrayValue(rawAuth.bearer, 'token') ?? ''
    return { token, type: 'bearer' }
  }

  if (type === 'basic') {
    return {
      password: getKeyValueArrayValue(rawAuth.basic, 'password') ?? '',
      type: 'basic',
      username: getKeyValueArrayValue(rawAuth.basic, 'username') ?? '',
    }
  }

  addWarning(warnings, source, `Unsupported auth type "${type}" skipped`)
  return { type: 'none' }
}

function parseHeaders(rawHeaders: unknown): HttpHeaderEntry[] {
  return asArray(rawHeaders)
    .filter(isRecord)
    .map(header => ({
      enabled: header.disabled === true ? false : undefined,
      key: asString(header.key),
      value: asString(header.value),
    }))
}

function parsePostmanQuery(rawUrl: unknown): HttpImportRequest['query'] {
  if (!isRecord(rawUrl)) {
    return []
  }

  return asArray(rawUrl.query)
    .filter(isRecord)
    .map(entry => ({
      enabled: entry.disabled === true ? false : undefined,
      key: asString(entry.key),
      value: asString(entry.value),
    }))
}

function parseUrl(rawUrl: unknown): {
  url: string
  query: HttpImportRequest['query']
} {
  if (typeof rawUrl === 'string') {
    return splitUrlAndQuery(rawUrl)
  }

  if (!isRecord(rawUrl)) {
    return { query: [], url: '' }
  }

  const raw = asString(rawUrl.raw)
  const parsed = splitUrlAndQuery(raw)
  const query = parsePostmanQuery(rawUrl)

  return {
    query: query.length > 0 ? query : parsed.query,
    url: parsed.url,
  }
}

function parseBody(
  rawBody: unknown,
  source: string,
  warnings: HttpImportWarning[],
): Pick<HttpImportRequest, 'body' | 'bodyType' | 'formData'> {
  if (!isRecord(rawBody)) {
    return { body: null, bodyType: 'none', formData: [] }
  }

  const mode = asString(rawBody.mode)
  if (mode === 'raw') {
    const raw = asString(rawBody.raw)
    const language
      = isRecord(rawBody.options)
        && isRecord(rawBody.options.raw)
        && rawBody.options.raw.language === 'json'

    return {
      body: raw,
      bodyType: language ? 'json' : 'text',
      formData: [],
    }
  }

  if (mode === 'urlencoded') {
    const body = asArray(rawBody.urlencoded)
      .filter(isRecord)
      .filter(entry => entry.disabled !== true && asString(entry.key))
      .map(entry => `${asString(entry.key)}=${asString(entry.value)}`)
      .join('&')

    return { body, bodyType: 'form-urlencoded', formData: [] }
  }

  if (mode === 'formdata') {
    return {
      body: null,
      bodyType: 'multipart',
      formData: asArray(rawBody.formdata)
        .filter(isRecord)
        .filter(entry => entry.disabled !== true && asString(entry.key))
        .map(entry => ({
          key: asString(entry.key),
          type: entry.type === 'file' ? 'file' : 'text',
          value: asString(entry.src || entry.value),
        })),
    }
  }

  if (mode === 'graphql') {
    addWarning(warnings, source, 'GraphQL body imported as JSON')
    return {
      body: JSON.stringify(rawBody.graphql ?? {}, null, 2),
      bodyType: 'json',
      formData: [],
    }
  }

  if (mode === 'file') {
    addWarning(warnings, source, 'Standalone file body skipped')
    return { body: null, bodyType: 'none', formData: [] }
  }

  return { body: null, bodyType: 'none', formData: [] }
}

function parseVariables(
  rawVariables: unknown,
  source: string,
  warnings: HttpImportWarning[],
): Record<string, string> {
  const variables: Record<string, string> = {}

  for (const variable of asArray(rawVariables)) {
    if (!isRecord(variable)) {
      continue
    }

    const key = asString(variable.key)
    if (!key) {
      continue
    }

    if (variable.disabled === true || variable.enabled === false) {
      addWarning(warnings, source, `Disabled variable "${key}" skipped`)
      continue
    }

    variables[key] = asString(variable.value)
  }

  return variables
}

function parseEnvironment(
  raw: UnknownRecord,
  fileName: string,
  warnings: HttpImportWarning[],
): HttpImportEnvironment {
  return {
    name: normalizeImportName(raw.name, fileName.replace(/\.json$/i, '')),
    variables: parseVariables(raw.values, fileName, warnings),
  }
}

function parseRequest(
  item: UnknownRecord,
  folderId: string | null,
  context: PostmanContext,
  source: string,
  warnings: HttpImportWarning[],
): HttpImportRequest | null {
  if (!isRecord(item.request)) {
    return null
  }

  const request = item.request
  const method = normalizeHttpMethod(request.method, source, warnings)
  if (!method) {
    return null
  }

  const url = parseUrl(request.url)
  const headers = normalizeEntries(
    parseHeaders(request.header),
    source,
    warnings,
  )
  const auth = resolveAuthConflict(
    headers,
    parseAuth(request.auth, source, warnings) ?? context.auth,
    source,
    warnings,
  )
  const body = parseBody(request.body, source, warnings)
  const parts = createEmptyRequestParts()

  return {
    ...parts,
    ...body,
    auth,
    description: asString(request.description),
    folderId,
    headers,
    method,
    name: normalizeImportName(item.name, 'Imported request'),
    query: normalizeEntries(url.query, source, warnings),
    sourceId: asString(item.id || item._postman_id) || undefined,
    url: url.url,
  }
}

function walkItems(
  items: unknown[],
  collection: HttpImportCollection,
  parentId: string | null,
  context: PostmanContext,
  sourcePath: string,
  warnings: HttpImportWarning[],
): void {
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      continue
    }

    const name = normalizeImportName(item.name, `Item ${index + 1}`)
    const source = `${sourcePath}/${name}`
    const itemAuth = parseAuth(item.auth, source, warnings)
    const nextContext = itemAuth ? { auth: itemAuth } : context

    if (Array.isArray(item.item)) {
      const id = asString(item.id || item._postman_id) || `${source}:${index}`
      const folder: HttpImportFolder = { id, name, parentId }
      collection.folders.push(folder)
      walkItems(item.item, collection, id, nextContext, source, warnings)
      continue
    }

    const request = parseRequest(item, parentId, nextContext, source, warnings)
    if (request) {
      collection.requests.push(request)
    }
  }
}

function parseCollection(
  raw: UnknownRecord,
  fileName: string,
  warnings: HttpImportWarning[],
): HttpImportCollection {
  const info = isRecord(raw.info) ? raw.info : {}
  const name = normalizeImportName(info.name, fileName.replace(/\.json$/i, ''))
  const auth = parseAuth(raw.auth, fileName, warnings) ?? {
    type: 'none' as const,
  }
  const collection: HttpImportCollection = {
    description: asString(info.description),
    folders: [],
    name,
    requests: [],
  }

  walkItems(asArray(raw.item), collection, null, { auth }, name, warnings)
  return collection
}

export function parsePostmanFiles(files: HttpImportFile[]): HttpImportResult {
  const warnings: HttpImportWarning[] = []
  const collections: HttpImportCollection[] = []
  const environments: HttpImportEnvironment[] = []

  for (const file of files) {
    if (!isJsonFile(file))
      continue

    const raw = readJsonFile(file, warnings)
    if (!raw) {
      continue
    }

    if (isPostmanCollection(raw)) {
      collections.push(parseCollection(raw, file.name, warnings))

      const variables = parseVariables(raw.variable, file.name, warnings)
      if (Object.keys(variables).length > 0) {
        const infoName = isRecord(raw.info) ? raw.info.name : undefined
        environments.push({
          name: `${normalizeImportName(infoName, file.name.replace(/\.json$/i, ''))} Variables`,
          variables,
        })
      }

      continue
    }

    if (isPostmanEnvironment(raw)) {
      environments.push(parseEnvironment(raw, file.name, warnings))
      continue
    }

    if (isOpenApiDocument(raw))
      continue

    addWarning(warnings, file.name, 'Unsupported import file skipped')
  }

  return { collections, environments, warnings }
}
