import type {
  HttpAuth,
  HttpHeaderEntry,
  HttpQueryEntry,
} from '../../types/http'
import type {
  HttpImportCollection,
  HttpImportEnvironment,
  HttpImportFile,
  HttpImportFolder,
  HttpImportRequest,
  HttpImportResult,
  HttpImportWarning,
} from './types'
import yaml from 'js-yaml'
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

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
] as const

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  if (typeof value === 'string')
    return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

function isImportableFile(file: HttpImportFile): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml')
  )
}

function readDocument(file: HttpImportFile, warnings: HttpImportWarning[]) {
  try {
    return yaml.load(file.content) as unknown
  }
  catch {
    addWarning(warnings, file.name, 'Invalid OpenAPI file skipped')
    return null
  }
}

function isOpenApiDocument(raw: unknown): raw is UnknownRecord {
  return (
    isRecord(raw)
    && isRecord(raw.paths)
    && (typeof raw.openapi === 'string' || typeof raw.swagger === 'string')
  )
}

function basename(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  const slashIndex = normalized.lastIndexOf('/')
  const name
    = slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1)
  return name.replace(/\.(?:json|ya?ml)$/i, '')
}

function resolveRef(root: UnknownRecord, value: unknown): unknown {
  if (!isRecord(value) || typeof value.$ref !== 'string')
    return value
  if (!value.$ref.startsWith('#/'))
    return value

  return (
    value.$ref
      .slice(2)
      .split('/')
      .reduce<unknown>((current, segment) => {
        if (!isRecord(current))
          return undefined
        return current[segment.replace(/~1/g, '/').replace(/~0/g, '~')]
      }, root) ?? value
  )
}

function openApiTemplateToVariables(value: string): string {
  return value
    .replaceAll('%7B%7B', '__MASSCODE_OPEN_VAR__')
    .replaceAll('%7D%7D', '__MASSCODE_CLOSE_VAR__')
    .replace(/\{([^{}]+)\}/g, '{{$1}}')
    .replaceAll('__MASSCODE_OPEN_VAR__', '{{')
    .replaceAll('__MASSCODE_CLOSE_VAR__', '}}')
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = openApiTemplateToVariables(baseUrl).replace(
    /\/+$/g,
    '',
  )
  const normalizedPath = openApiTemplateToVariables(path)
  if (!normalizedBase)
    return normalizedPath
  if (!normalizedPath)
    return normalizedBase
  return `${normalizedBase}/${normalizedPath.replace(/^\/+/g, '')}`
}

function getInfo(raw: UnknownRecord): UnknownRecord {
  return isRecord(raw.info) ? raw.info : {}
}

function getCollectionName(file: HttpImportFile, raw: UnknownRecord): string {
  const info = getInfo(raw)
  return normalizeImportName(info.title, basename(file.name))
}

function getDescription(operation: UnknownRecord): string {
  return asString(operation.description || operation.summary)
}

function getRequestName(
  operation: UnknownRecord,
  method: string,
  path: string,
): string {
  return normalizeImportName(
    operation.summary || operation.operationId,
    `${method.toUpperCase()} ${path}`,
  )
}

function getServers(
  raw: UnknownRecord,
  pathItem: UnknownRecord,
  operation: UnknownRecord,
): UnknownRecord[] {
  const operationServers = asArray(operation.servers).filter(isRecord)
  if (operationServers.length > 0)
    return operationServers

  const pathServers = asArray(pathItem.servers).filter(isRecord)
  if (pathServers.length > 0)
    return pathServers

  return asArray(raw.servers).filter(isRecord)
}

function getServerUrl(
  raw: UnknownRecord,
  pathItem: UnknownRecord,
  operation: UnknownRecord,
): string {
  const server = getServers(raw, pathItem, operation)[0]
  return server ? asString(server.url) : ''
}

function getParameterValue(parameter: UnknownRecord): string {
  if (parameter.example !== undefined)
    return asString(parameter.example)
  if (isRecord(parameter.schema)) {
    if (parameter.schema.default !== undefined)
      return asString(parameter.schema.default)
    if (parameter.schema.example !== undefined)
      return asString(parameter.schema.example)
  }
  return ''
}

function parseParameters(
  rawParameters: unknown[],
  root: UnknownRecord,
): {
    headers: HttpHeaderEntry[]
    pathExamples: Record<string, string>
    query: HttpQueryEntry[]
  } {
  const headers: HttpHeaderEntry[] = []
  const pathExamples: Record<string, string> = {}
  const query: HttpQueryEntry[] = []

  for (const rawParameter of rawParameters) {
    const parameter = resolveRef(root, rawParameter)
    if (!isRecord(parameter))
      continue

    const name = asString(parameter.name)
    if (!name)
      continue

    const entry = {
      description: asString(parameter.description) || undefined,
      key: name,
      value: getParameterValue(parameter),
    }

    if (parameter.in === 'query') {
      query.push(entry)
      continue
    }

    if (parameter.in === 'header') {
      headers.push(entry)
      continue
    }

    if (parameter.in === 'path') {
      pathExamples[name] = entry.value
    }
  }

  return { headers, pathExamples, query }
}

function mergeQueryEntries(
  urlQuery: HttpQueryEntry[],
  explicitQuery: HttpQueryEntry[],
): HttpQueryEntry[] {
  const explicitKeys = new Set(explicitQuery.map(entry => entry.key))
  return [
    ...urlQuery.filter(entry => !explicitKeys.has(entry.key)),
    ...explicitQuery,
  ]
}

function pickMediaEntry(content: UnknownRecord): {
  mediaType: string
  media: UnknownRecord
} | null {
  const preferredTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ]

  for (const mediaType of preferredTypes) {
    if (isRecord(content[mediaType])) {
      return { media: content[mediaType], mediaType }
    }
  }

  const firstEntry = Object.entries(content).find(([, value]) =>
    isRecord(value),
  )
  if (!firstEntry)
    return null

  return { media: firstEntry[1] as UnknownRecord, mediaType: firstEntry[0] }
}

function sampleFromSchema(schema: unknown): unknown {
  if (!isRecord(schema))
    return ''
  if (schema.example !== undefined)
    return schema.example
  if (schema.default !== undefined)
    return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length > 0)
    return schema.enum[0]

  if (schema.type === 'object' || isRecord(schema.properties)) {
    const result: Record<string, unknown> = {}
    if (isRecord(schema.properties)) {
      for (const [key, property] of Object.entries(schema.properties)) {
        result[key] = sampleFromSchema(property)
      }
    }
    return result
  }

  if (schema.type === 'array') {
    return [sampleFromSchema(schema.items)]
  }

  if (schema.type === 'integer' || schema.type === 'number')
    return 0
  if (schema.type === 'boolean')
    return false
  return ''
}

function parseRequestBody(
  rawBody: unknown,
  root: UnknownRecord,
  source: string,
  warnings: HttpImportWarning[],
): Pick<HttpImportRequest, 'body' | 'bodyType' | 'formData'> {
  const body = resolveRef(root, rawBody)
  if (!isRecord(body) || !isRecord(body.content)) {
    return { body: null, bodyType: 'none', formData: [] }
  }

  const pickedMedia = pickMediaEntry(body.content)
  if (!pickedMedia) {
    addWarning(warnings, source, 'Request body content skipped')
    return { body: null, bodyType: 'none', formData: [] }
  }

  const example = pickedMedia.media.example
  const value
    = example !== undefined
      ? example
      : sampleFromSchema(resolveRef(root, pickedMedia.media.schema))

  if (pickedMedia.mediaType === 'application/json') {
    return {
      body: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      bodyType: 'json',
      formData: [],
    }
  }

  if (pickedMedia.mediaType === 'application/x-www-form-urlencoded') {
    const formValue = isRecord(value) ? value : {}
    return {
      body: Object.entries(formValue)
        .map(([key, entryValue]) => `${key}=${asString(entryValue)}`)
        .join('&'),
      bodyType: 'form-urlencoded',
      formData: [],
    }
  }

  if (pickedMedia.mediaType === 'multipart/form-data') {
    const formValue = isRecord(value) ? value : {}
    return {
      body: null,
      bodyType: 'multipart',
      formData: Object.entries(formValue).map(([key, entryValue]) => ({
        key,
        type: 'text' as const,
        value: asString(entryValue),
      })),
    }
  }

  if (pickedMedia.mediaType.startsWith('text/')) {
    return { body: asString(value), bodyType: 'text', formData: [] }
  }

  addWarning(
    warnings,
    source,
    `Request body media "${pickedMedia.mediaType}" imported as text`,
  )
  return {
    body: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    bodyType: 'text',
    formData: [],
  }
}

function getSecuritySchemes(root: UnknownRecord): UnknownRecord {
  if (isRecord(root.components) && isRecord(root.components.securitySchemes))
    return root.components.securitySchemes
  if (isRecord(root.securityDefinitions))
    return root.securityDefinitions
  return {}
}

function parseSecurity(
  root: UnknownRecord,
  operation: UnknownRecord,
  source: string,
  warnings: HttpImportWarning[],
): {
    auth: HttpAuth
    headers: HttpHeaderEntry[]
    query: HttpQueryEntry[]
    variables: Record<string, string>
  } {
  const requirements = Array.isArray(operation.security)
    ? operation.security
    : asArray(root.security)
  const requirement = requirements.find(isRecord)
  if (!requirement)
    return { auth: { type: 'none' }, headers: [], query: [], variables: {} }

  const schemes = getSecuritySchemes(root)
  const variables: Record<string, string> = {}

  for (const name of Object.keys(requirement)) {
    const scheme = schemes[name]
    if (!isRecord(scheme))
      continue

    if (
      scheme.type === 'http'
      && asString(scheme.scheme).toLowerCase() === 'bearer'
    ) {
      variables[name] = ''
      return {
        auth: { token: `{{${name}}}`, type: 'bearer' },
        headers: [],
        query: [],
        variables,
      }
    }

    if (
      scheme.type === 'http'
      && asString(scheme.scheme).toLowerCase() === 'basic'
    ) {
      variables[`${name}Username`] = ''
      variables[`${name}Password`] = ''
      return {
        auth: {
          password: `{{${name}Password}}`,
          type: 'basic',
          username: `{{${name}Username}}`,
        },
        headers: [],
        query: [],
        variables,
      }
    }

    if (scheme.type === 'apiKey') {
      variables[name] = ''
      const entry = {
        key: asString(scheme.name),
        value: `{{${name}}}`,
      }

      if (scheme.in === 'query') {
        return {
          auth: { type: 'none' },
          headers: [],
          query: entry.key ? [entry] : [],
          variables,
        }
      }

      if (scheme.in === 'header') {
        return {
          auth: { type: 'none' },
          headers: entry.key ? [entry] : [],
          query: [],
          variables,
        }
      }
    }

    addWarning(
      warnings,
      source,
      `Unsupported security scheme "${name}" skipped`,
    )
  }

  return { auth: { type: 'none' }, headers: [], query: [], variables }
}

function getFolderId(
  collection: HttpImportCollection,
  foldersByTag: Map<string, string>,
  operation: UnknownRecord,
): string | null {
  const tag = asArray(operation.tags)
    .map(asString)
    .map(value => value.trim())
    .find(Boolean)
  if (!tag)
    return null

  const existing = foldersByTag.get(tag)
  if (existing)
    return existing

  const id = `tag:${tag}`
  const folder: HttpImportFolder = {
    id,
    name: normalizeImportName(tag, 'OpenAPI'),
    parentId: null,
  }
  foldersByTag.set(tag, id)
  collection.folders.push(folder)
  return id
}

function parseOperation(
  root: UnknownRecord,
  collection: HttpImportCollection,
  foldersByTag: Map<string, string>,
  environmentVariables: Record<string, string>,
  path: string,
  pathItem: UnknownRecord,
  method: string,
  operation: UnknownRecord,
  warnings: HttpImportWarning[],
): HttpImportRequest | null {
  const source = `${collection.name}/${method.toUpperCase()} ${path}`
  const normalizedMethod = normalizeHttpMethod(method, source, warnings)
  if (!normalizedMethod)
    return null

  const parameters = parseParameters(
    [...asArray(pathItem.parameters), ...asArray(operation.parameters)],
    root,
  )
  Object.assign(environmentVariables, parameters.pathExamples)

  const rawUrl = joinUrl(getServerUrl(root, pathItem, operation), path)
  const parsedUrl = splitUrlAndQuery(rawUrl)
  const security = parseSecurity(root, operation, source, warnings)
  Object.assign(environmentVariables, security.variables)

  const headers = normalizeEntries(
    [...parameters.headers, ...security.headers],
    source,
    warnings,
  )
  const query = normalizeEntries(
    [
      ...mergeQueryEntries(parsedUrl.query, parameters.query),
      ...security.query,
    ],
    source,
    warnings,
  )
  const body = parseRequestBody(operation.requestBody, root, source, warnings)
  const parts = createEmptyRequestParts()

  return {
    ...parts,
    ...body,
    auth: resolveAuthConflict(headers, security.auth, source, warnings),
    description: getDescription(operation),
    folderId: getFolderId(collection, foldersByTag, operation),
    headers,
    method: normalizedMethod,
    name: getRequestName(operation, method, path),
    query,
    sourceId: asString(operation.operationId) || undefined,
    url: parsedUrl.url,
  }
}

function parseOpenApiFile(
  file: HttpImportFile,
  raw: UnknownRecord,
  warnings: HttpImportWarning[],
): {
    collection: HttpImportCollection | null
    environment: HttpImportEnvironment | null
  } {
  const collection: HttpImportCollection = {
    description: asString(getInfo(raw).description),
    folders: [],
    name: getCollectionName(file, raw),
    requests: [],
  }
  const foldersByTag = new Map<string, string>()
  const environmentVariables: Record<string, string> = {}

  const paths = isRecord(raw.paths) ? raw.paths : {}
  for (const [path, rawPathItem] of Object.entries(paths)) {
    if (!isRecord(rawPathItem))
      continue

    for (const method of HTTP_METHODS) {
      const operation = rawPathItem[method]
      if (!isRecord(operation))
        continue

      const request = parseOperation(
        raw,
        collection,
        foldersByTag,
        environmentVariables,
        path,
        rawPathItem,
        method,
        operation,
        warnings,
      )
      if (request) {
        collection.requests.push(request)
      }
    }
  }

  const environment
    = Object.keys(environmentVariables).length > 0
      ? {
          name: `${collection.name} Examples`,
          variables: environmentVariables,
        }
      : null

  return {
    collection: collection.requests.length > 0 ? collection : null,
    environment,
  }
}

export function parseOpenApiFiles(files: HttpImportFile[]): HttpImportResult {
  const warnings: HttpImportWarning[] = []
  const collections: HttpImportCollection[] = []
  const environments: HttpImportEnvironment[] = []

  for (const file of files) {
    if (!isImportableFile(file))
      continue

    const raw = readDocument(file, warnings)
    if (!isOpenApiDocument(raw))
      continue

    const result = parseOpenApiFile(file, raw, warnings)
    if (result.collection) {
      collections.push(result.collection)
    }
    if (result.environment) {
      environments.push(result.environment)
    }
  }

  return { collections, environments, warnings }
}
