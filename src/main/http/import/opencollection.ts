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

function isYamlFile(file: HttpImportFile): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.yml') || name.endsWith('.yaml')
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+/, '')
}

function dirname(path: string): string {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index === -1 ? '' : normalized.slice(0, index)
}

function basename(path: string): string {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  const name = index === -1 ? normalized : normalized.slice(index + 1)
  return name.replace(/\.(ya?ml)$/i, '')
}

function stripRootDir(path: string, rootDir: string): string {
  const normalized = normalizePath(path)
  const normalizedRootDir = normalizePath(rootDir)
  if (!normalizedRootDir)
    return normalized
  if (normalized === normalizedRootDir)
    return ''
  if (normalized.startsWith(`${normalizedRootDir}/`))
    return normalized.slice(normalizedRootDir.length + 1)
  return normalized
}

function isInsideRoot(path: string, rootDir: string): boolean {
  const normalized = normalizePath(path)
  const normalizedRootDir = normalizePath(rootDir)
  if (!normalizedRootDir)
    return true
  return normalized.startsWith(`${normalizedRootDir}/`)
}

function readYaml(file: HttpImportFile, warnings: HttpImportWarning[]) {
  try {
    return yaml.load(file.content) as unknown
  }
  catch {
    addWarning(warnings, file.name, 'Invalid YAML skipped')
    return null
  }
}

function getInfo(raw: unknown): UnknownRecord {
  return isRecord(raw) && isRecord(raw.info) ? raw.info : {}
}

function isOpenCollectionRoot(file: HttpImportFile, raw: unknown): boolean {
  return (
    /(?:^|\/)opencollection\.ya?ml$/i.test(normalizePath(file.name))
    && isRecord(raw)
  )
}

function isBundledCollection(raw: unknown): raw is UnknownRecord {
  return isRecord(raw) && Array.isArray(raw.items)
}

function isFolderFile(file: HttpImportFile, raw: unknown): boolean {
  const info = getInfo(raw)
  return (
    /(?:^|\/)folder\.ya?ml$/i.test(normalizePath(file.name))
    || info.type === 'folder'
  )
}

function isRequestFile(raw: unknown): raw is UnknownRecord {
  const info = getInfo(raw)
  return isRecord(raw) && info.type === 'http' && isRecord(raw.http)
}

function parseHeaders(rawHeaders: unknown): HttpHeaderEntry[] {
  return asArray(rawHeaders)
    .filter(isRecord)
    .map(header => ({
      enabled: header.disabled === true ? false : undefined,
      key: asString(header.name ?? header.key),
      value: asString(header.value),
    }))
}

function parseParams(rawParams: unknown): {
  pathParams: Record<string, string>
  query: HttpQueryEntry[]
} {
  const params = asArray(rawParams).filter(isRecord)
  const pathParams: Record<string, string> = {}
  const query: HttpQueryEntry[] = []

  for (const param of params) {
    const type = asString(param.type)
    const name = asString(param.name ?? param.key)
    const value = asString(param.value)
    if (!name)
      continue

    if (type === 'path') {
      pathParams[name] = value
      continue
    }

    if (type === 'query') {
      query.push({
        enabled: param.disabled === true ? false : undefined,
        key: name,
        value,
      })
    }
  }

  return { pathParams, query }
}

function applyPathParams(
  url: string,
  pathParams: Record<string, string>,
): string {
  let nextUrl = url
  for (const name of Object.keys(pathParams)) {
    nextUrl = nextUrl.replaceAll(`:${name}`, `{{${name}}}`)
  }
  return nextUrl
}

function parseAuth(
  rawAuth: unknown,
  source: string,
  warnings: HttpImportWarning[],
): { auth: HttpAuth, headers: HttpHeaderEntry[], query: HttpQueryEntry[] } {
  if (rawAuth === 'inherit' || rawAuth === undefined || rawAuth === null) {
    return { auth: { type: 'none' }, headers: [], query: [] }
  }

  if (!isRecord(rawAuth)) {
    return { auth: { type: 'none' }, headers: [], query: [] }
  }

  const type = asString(rawAuth.type).toLowerCase()
  if (!type || type === 'none' || type === 'inherit') {
    return { auth: { type: 'none' }, headers: [], query: [] }
  }

  if (type === 'bearer') {
    return {
      auth: { token: asString(rawAuth.token), type: 'bearer' },
      headers: [],
      query: [],
    }
  }

  if (type === 'basic') {
    return {
      auth: {
        password: asString(rawAuth.password),
        type: 'basic',
        username: asString(rawAuth.username),
      },
      headers: [],
      query: [],
    }
  }

  if (type === 'apikey') {
    const key = asString(rawAuth.key)
    const value = asString(rawAuth.value)
    const placement = asString(rawAuth.placement)
    addWarning(warnings, source, 'API key auth imported as request entry')

    if (placement === 'query') {
      return {
        auth: { type: 'none' },
        headers: [],
        query: key ? [{ key, value }] : [],
      }
    }

    return {
      auth: { type: 'none' },
      headers: key ? [{ key, value }] : [],
      query: [],
    }
  }

  addWarning(warnings, source, `Unsupported auth type "${type}" skipped`)
  return { auth: { type: 'none' }, headers: [], query: [] }
}

function parseBody(
  rawBody: unknown,
  source: string,
  warnings: HttpImportWarning[],
): Pick<HttpImportRequest, 'body' | 'bodyType' | 'formData'> {
  if (!isRecord(rawBody)) {
    return { body: null, bodyType: 'none', formData: [] }
  }

  const type = asString(rawBody.type)
  if (type === 'json') {
    return { body: asString(rawBody.data), bodyType: 'json', formData: [] }
  }

  if (type === 'text' || type === 'xml') {
    return { body: asString(rawBody.data), bodyType: 'text', formData: [] }
  }

  if (type === 'form-urlencoded') {
    const body = asArray(rawBody.data)
      .filter(isRecord)
      .filter(
        entry => entry.disabled !== true && asString(entry.name ?? entry.key),
      )
      .map(
        entry =>
          `${asString(entry.name ?? entry.key)}=${asString(entry.value)}`,
      )
      .join('&')
    return { body, bodyType: 'form-urlencoded', formData: [] }
  }

  if (type === 'multipart-form') {
    return {
      body: null,
      bodyType: 'multipart',
      formData: asArray(rawBody.data)
        .filter(isRecord)
        .filter(
          entry =>
            entry.disabled !== true && asString(entry.name ?? entry.key),
        )
        .map(entry => ({
          key: asString(entry.name ?? entry.key),
          type: asString(entry.type) === 'file' ? 'file' : 'text',
          value: asString(entry.value),
        })),
    }
  }

  if (type === 'graphql') {
    addWarning(warnings, source, 'GraphQL body imported as JSON')
    return {
      body: JSON.stringify(rawBody.data ?? {}, null, 2),
      bodyType: 'json',
      formData: [],
    }
  }

  return { body: null, bodyType: 'none', formData: [] }
}

function parseEnvironmentVariables(raw: unknown): Record<string, string> {
  const variables: Record<string, string> = {}

  if (Array.isArray(raw)) {
    for (const variable of raw) {
      if (!isRecord(variable))
        continue
      const key = asString(variable.name ?? variable.key)
      if (key && variable.disabled !== true) {
        variables[key] = asString(variable.value)
      }
    }
    return variables
  }

  if (isRecord(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      variables[key] = asString(value)
    }
  }

  return variables
}

function parseEnvironment(
  file: HttpImportFile,
  raw: unknown,
): HttpImportEnvironment | null {
  if (!/(?:^|\/)environments\/.+\.ya?ml$/i.test(normalizePath(file.name)))
    return null
  if (!isRecord(raw))
    return null

  const info = getInfo(raw)
  const variables = parseEnvironmentVariables(raw.variables ?? raw.vars)

  return {
    name: normalizeImportName(info.name ?? raw.name, basename(file.name)),
    variables,
  }
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

function parseRequest(
  file: HttpImportFile,
  raw: UnknownRecord,
  folderId: string | null,
  warnings: HttpImportWarning[],
): HttpImportRequest | null {
  const info = getInfo(raw)
  const http = isRecord(raw.http) ? raw.http : {}
  const source = file.name
  const method = normalizeHttpMethod(http.method, source, warnings)
  if (!method)
    return null

  const params = parseParams(http.params)
  const parsedUrl = splitUrlAndQuery(
    applyPathParams(asString(http.url), params.pathParams),
  )
  const auth = parseAuth(http.auth, source, warnings)
  const headers = normalizeEntries(
    [...parseHeaders(http.headers), ...auth.headers],
    source,
    warnings,
  )
  const query = normalizeEntries(
    [...mergeQueryEntries(parsedUrl.query, params.query), ...auth.query],
    source,
    warnings,
  )
  const body = parseBody(http.body, source, warnings)
  const parts = createEmptyRequestParts()

  if (isRecord(raw.runtime)) {
    if (Array.isArray(raw.runtime.scripts)) {
      addWarning(warnings, source, 'Runtime scripts skipped')
    }
    if (Array.isArray(raw.runtime.assertions)) {
      addWarning(warnings, source, 'Assertions skipped')
    }
  }

  return {
    ...parts,
    ...body,
    auth: resolveAuthConflict(headers, auth.auth, source, warnings),
    description: asString(raw.docs),
    folderId,
    headers,
    method,
    name: normalizeImportName(info.name, basename(file.name)),
    query,
    url: parsedUrl.url,
  }
}

function ensureFolder(
  collection: HttpImportCollection,
  folderIds: Map<string, string>,
  folderNames: Map<string, string>,
  path: string,
): string | null {
  const normalized = normalizePath(path)
  if (!normalized)
    return null

  const segments = normalized.split('/').filter(Boolean)
  let currentPath = ''
  let parentId: string | null = null

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    const existing = folderIds.get(currentPath)
    if (existing) {
      parentId = existing
      continue
    }

    const id = currentPath
    const folder: HttpImportFolder = {
      id,
      name: normalizeImportName(folderNames.get(currentPath), segment),
      parentId,
    }
    folderIds.set(currentPath, id)
    collection.folders.push(folder)
    parentId = id
  }

  return parentId
}

function parseBundledItems(
  items: unknown[],
  collection: HttpImportCollection,
  parentId: string | null,
  source: string,
  warnings: HttpImportWarning[],
) {
  for (const [index, item] of items.entries()) {
    if (!isRecord(item))
      continue

    const info = getInfo(item)
    const name = normalizeImportName(info.name, `Item ${index + 1}`)
    const childItems = asArray(item.items)

    if (info.type === 'folder' || childItems.length > 0) {
      const folder: HttpImportFolder = {
        id: `${source}:${collection.folders.length}`,
        name,
        parentId,
      }
      collection.folders.push(folder)
      parseBundledItems(childItems, collection, folder.id, source, warnings)
      continue
    }

    if (!isRequestFile(item))
      continue

    const request = parseRequest(
      { content: '', name: `${source}/${name}.yml` },
      item,
      parentId,
      warnings,
    )
    if (request) {
      collection.requests.push(request)
    }
  }
}

function parseBundledCollection(
  file: HttpImportFile,
  raw: UnknownRecord,
  warnings: HttpImportWarning[],
): {
    collection: HttpImportCollection | null
    environment: HttpImportEnvironment | null
  } {
  const info = getInfo(raw)
  const collectionName = normalizeImportName(info.name, basename(file.name))
  const collection: HttpImportCollection = {
    folders: [],
    name: collectionName,
    requests: [],
  }

  parseBundledItems(asArray(raw.items), collection, null, file.name, warnings)

  const variables = parseEnvironmentVariables(raw.variables ?? raw.vars)
  const environment
    = Object.keys(variables).length > 0
      ? { name: `${collectionName} Variables`, variables }
      : null

  return {
    collection: collection.requests.length > 0 ? collection : null,
    environment,
  }
}

export function parseOpenCollectionFiles(
  files: HttpImportFile[],
): HttpImportResult {
  const warnings: HttpImportWarning[] = []
  const yamlFiles = files.filter(isYamlFile)
  const parsedFiles = yamlFiles
    .map(file => ({ file, raw: readYaml(file, warnings) }))
    .filter(
      (entry): entry is { file: HttpImportFile, raw: unknown } =>
        entry.raw !== null,
    )

  const rootEntries = parsedFiles.filter(entry =>
    isOpenCollectionRoot(entry.file, entry.raw),
  )
  const bundledEntries = parsedFiles.filter(
    (entry): entry is { file: HttpImportFile, raw: UnknownRecord } =>
      isBundledCollection(entry.raw),
  )
  if (rootEntries.length === 0 && bundledEntries.length === 0) {
    return { collections: [], environments: [], warnings: [] }
  }

  const collections: HttpImportCollection[] = []
  const environments: HttpImportEnvironment[] = []

  for (const entry of bundledEntries) {
    const result = parseBundledCollection(entry.file, entry.raw, warnings)
    if (result.collection) {
      collections.push(result.collection)
    }
    if (result.environment) {
      environments.push(result.environment)
    }
  }

  for (const rootEntry of rootEntries) {
    if (isBundledCollection(rootEntry.raw))
      continue

    const rootInfo = getInfo(rootEntry.raw)
    const rootDir = dirname(normalizePath(rootEntry.file.name))
    const rootFiles = parsedFiles.filter(entry =>
      isInsideRoot(entry.file.name, rootDir),
    )
    const collection: HttpImportCollection = {
      folders: [],
      name: normalizeImportName(
        rootInfo.name,
        rootDir ? basename(rootDir) : 'Bruno Collection',
      ),
      requests: [],
    }
    const folderNames = new Map<string, string>()

    for (const entry of rootFiles) {
      const relativePath = stripRootDir(entry.file.name, rootDir)
      if (!isFolderFile({ ...entry.file, name: relativePath }, entry.raw))
        continue

      const folderPath = dirname(relativePath)
      const info = getInfo(entry.raw)
      folderNames.set(
        folderPath,
        normalizeImportName(info.name, basename(folderPath)),
      )
    }

    const folderIds = new Map<string, string>()
    for (const entry of rootFiles) {
      const relativePath = stripRootDir(entry.file.name, rootDir)
      const relativeFile = { ...entry.file, name: relativePath }

      const environment = parseEnvironment(relativeFile, entry.raw)
      if (environment) {
        environments.push(environment)
        continue
      }

      if (!isRequestFile(entry.raw))
        continue

      const folderId = ensureFolder(
        collection,
        folderIds,
        folderNames,
        dirname(relativePath),
      )
      const request = parseRequest(relativeFile, entry.raw, folderId, warnings)
      if (request) {
        collection.requests.push(request)
      }
    }

    if (collection.requests.length > 0) {
      collections.push(collection)
    }
  }

  return { collections, environments, warnings }
}
