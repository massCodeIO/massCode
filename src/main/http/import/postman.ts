import type { HttpAuth, HttpHeaderEntry } from '../../types/http'
import type { ImportedScript } from './runtime/scripts'
import type {
  HttpImportCollection,
  HttpImportEnvironment,
  HttpImportFile,
  HttpImportFolder,
  HttpImportRequest,
  HttpImportResult,
  HttpImportWarning,
} from './types'
import { emptyHttpCollection } from '../../../shared/httpCollection'
import { validateImportFiles, validateImportTree } from './limits'
import {
  addWarning,
  createEmptyRequestParts,
  normalizeEntries,
  normalizeHttpMethod,
  normalizeImportName,
  resolveAuthConflict,
  splitUrlAndQuery,
} from './normalize'
import {
  buildImportedRuntime,
  postmanScripts,
  runtimeWarning,
} from './runtime'

type UnknownRecord = Record<string, unknown>

interface PostmanContext {
  scripts: ImportedScript[]
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

function parseDescription(value: unknown): string {
  return isRecord(value) ? asString(value.content) : asString(value)
}

function readJsonFile(file: HttpImportFile, warnings: HttpImportWarning[]) {
  try {
    const raw: unknown = JSON.parse(file.content)
    validateImportTree(raw)
    return raw
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

  if (type === 'apikey') {
    return {
      type: 'apikey',
      key: getKeyValueArrayValue(rawAuth.apikey, 'key') ?? '',
      value: getKeyValueArrayValue(rawAuth.apikey, 'value') ?? '',
      in:
        getKeyValueArrayValue(rawAuth.apikey, 'in') === 'query'
          ? 'query'
          : 'header',
    }
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
      description: parseDescription(header.description) || undefined,
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
      description: parseDescription(entry.description) || undefined,
      enabled:
        entry.disabled === true || entry.enabled === false ? false : undefined,
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
    return {
      body: null,
      bodyType: 'form-urlencoded',
      formData: asArray(rawBody.urlencoded)
        .filter(isRecord)
        .map(entry => ({
          key: asString(entry.key),
          value: asString(entry.value),
          type: 'text',
          enabled:
            entry.disabled === true || entry.enabled === false
              ? false
              : undefined,
          description: parseDescription(entry.description) || undefined,
        })),
    }
  }

  if (mode === 'formdata') {
    return {
      body: null,
      bodyType: 'multipart',
      formData: asArray(rawBody.formdata)
        .filter(isRecord)
        .map(entry => ({
          enabled:
            entry.disabled === true || entry.enabled === false
              ? false
              : undefined,
          description: parseDescription(entry.description) || undefined,
          key: asString(entry.key),
          type: entry.type === 'file' ? 'file' : 'text',
          value: asString(entry.src || entry.value),
        })),
    }
  }

  if (mode === 'graphql') {
    const graphql = isRecord(rawBody.graphql) ? { ...rawBody.graphql } : {}
    if (typeof graphql.variables === 'string') {
      try {
        const variables: unknown = graphql.variables.trim()
          ? JSON.parse(graphql.variables)
          : {}
        if (!isRecord(variables))
          throw new Error('Invalid variables')
        graphql.variables = variables
      }
      catch {
        addWarning(
          warnings,
          source,
          'spaces.http.import.runtimeWarnings.graphqlVariables',
        )
      }
    }
    return {
      body: JSON.stringify({
        query: asString(graphql.query),
        variables:
          typeof graphql.variables === 'string'
            ? graphql.variables
            : JSON.stringify(graphql.variables ?? {}),
        operationName: asString(graphql.operationName),
      }),
      bodyType: 'graphql',
      formData: [],
    }
  }

  if (mode === 'file') {
    return {
      body: isRecord(rawBody.file) ? asString(rawBody.file.src) : '',
      bodyType: 'binary',
      formData: [],
    }
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

function parseCollectionConfig(
  raw: UnknownRecord,
  parent: boolean,
  source: string,
  warnings: HttpImportWarning[],
) {
  const config = emptyHttpCollection()
  config.documentation = parseDescription(raw.description)
  config.auth = parseAuth(raw.auth, source, warnings) ?? {
    type: parent ? 'inherit' : 'none',
  }
  config.postResponseOrder = 'parent-first'
  config.variables = asArray(raw.variable)
    .filter(isRecord)
    .map(entry => ({
      key: asString(entry.key),
      value: asString(entry.value),
      enabled:
        entry.disabled === true || entry.enabled === false ? false : undefined,
      description: parseDescription(entry.description) || undefined,
    }))
  const imported = buildImportedRuntime(
    postmanScripts(raw.event, source, warnings),
    'postman',
    source,
    warnings,
  )
  if (imported.runtime)
    config.runtime = imported.runtime
  return config
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
    parseAuth(request.auth, source, warnings) ?? { type: 'inherit' },
    source,
    warnings,
  )
  const body = parseBody(request.body, source, warnings)
  const parts = createEmptyRequestParts()
  const scripts = [
    ...context.scripts,
    ...postmanScripts(item.event, source, warnings),
  ]
  if (item.variable !== undefined) {
    runtimeWarning(warnings, source, 'scopedVariables')
    scripts.push({ source, phase: 'preRequest', code: '', invalid: true })
  }

  return {
    ...parts,
    ...body,
    ...buildImportedRuntime(
      [
        ...postmanScripts(item.event, source, warnings),
        ...(item.variable !== undefined
          ? [{ source, phase: 'preRequest' as const, code: '', invalid: true }]
          : []),
      ],
      'postman',
      source,
      warnings,
    ),
    scriptStatus: buildImportedRuntime(scripts, 'postman', source, [])
      .scriptStatus,
    auth,
    description: parseDescription(request.description),
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
    if (collection.requests.length >= 1000)
      throw new Error('spaces.http.import.runtimeWarnings.fileLimit')
    if (!isRecord(item)) {
      continue
    }

    const name = normalizeImportName(item.name, `Item ${index + 1}`)
    const source = `${sourcePath}/${name}`
    const itemAuth = parseAuth(item.auth, source, warnings)
    const nextContext = { ...context, auth: itemAuth ?? context.auth }

    if (Array.isArray(item.item)) {
      const id = asString(item.id || item._postman_id) || `${source}:${index}`
      const folder: HttpImportFolder = {
        id,
        name,
        parentId,
        description: parseDescription(item.description),
        collectionConfig: parseCollectionConfig(item, true, source, warnings),
      }
      collection.folders.push(folder)
      if (source.split('/').length > 32) {
        runtimeWarning(warnings, source, 'depthLimit')
        continue
      }
      walkItems(
        item.item,
        collection,
        id,
        {
          ...nextContext,
          scripts: [
            ...nextContext.scripts,
            ...postmanScripts(item.event, source, warnings),
          ],
        },
        source,
        warnings,
      )
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
    description: parseDescription(info.description),
    collectionConfig: parseCollectionConfig(
      { ...raw, description: info.description },
      false,
      name,
      warnings,
    ),
    folders: [],
    name,
    requests: [],
  }

  walkItems(
    asArray(raw.item),
    collection,
    null,
    { auth, scripts: postmanScripts(raw.event, name, warnings) },
    name,
    warnings,
  )
  return collection
}

export function parsePostmanFiles(files: HttpImportFile[]): HttpImportResult {
  validateImportFiles(files)
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
