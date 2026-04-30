import type {
  HttpAuth,
  HttpBodyType,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpMethod,
  HttpQueryEntry,
  HttpRequestFrontmatter,
  HttpRequestRecord,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]
const HTTP_BODY_TYPES: HttpBodyType[] = [
  'none',
  'json',
  'text',
  'form-urlencoded',
  'multipart',
]

function splitFrontmatter(source: string): {
  body: string
  frontmatter: HttpRequestFrontmatter
  hasFrontmatter: boolean
} {
  const match = source.match(FRONTMATTER_RE)

  if (!match) {
    return { body: source, frontmatter: {}, hasFrontmatter: false }
  }

  const parsed = yaml.load(match[1])
  return {
    body: match[2] || '',
    frontmatter:
      parsed && typeof parsed === 'object'
        ? (parsed as HttpRequestFrontmatter)
        : {},
    hasFrontmatter: true,
  }
}

function normalizeMethod(value: unknown): HttpMethod {
  if (typeof value !== 'string') {
    return 'GET'
  }

  const upper = value.toUpperCase() as HttpMethod
  return HTTP_METHODS.includes(upper) ? upper : 'GET'
}

function normalizeBodyType(value: unknown): HttpBodyType {
  if (typeof value !== 'string') {
    return 'none'
  }

  return HTTP_BODY_TYPES.includes(value as HttpBodyType)
    ? (value as HttpBodyType)
    : 'none'
}

function normalizeKeyValueEntries<T extends { key: string, value: string }>(
  raw: unknown,
  extra?: (entry: Record<string, unknown>) => Partial<T>,
): T[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === 'object'),
    )
    .map((entry) => {
      const key = typeof entry.key === 'string' ? entry.key : ''
      const value = typeof entry.value === 'string' ? entry.value : ''
      return { key, value, ...(extra ? extra(entry) : {}) } as T
    })
}

function normalizeHeaders(raw: unknown): HttpHeaderEntry[] {
  return normalizeKeyValueEntries<HttpHeaderEntry>(raw)
}

function normalizeQuery(raw: unknown): HttpQueryEntry[] {
  return normalizeKeyValueEntries<HttpQueryEntry>(raw)
}

function normalizeFormData(raw: unknown): HttpFormDataEntry[] {
  return normalizeKeyValueEntries<HttpFormDataEntry>(raw, (entry) => {
    const type = entry.type === 'file' ? 'file' : 'text'
    return { type }
  })
}

function normalizeAuth(raw: unknown): HttpAuth {
  if (!raw || typeof raw !== 'object') {
    return { type: 'none' }
  }

  const data = raw as Record<string, unknown>
  const type
    = data.type === 'bearer' || data.type === 'basic' ? data.type : 'none'

  const auth: HttpAuth = { type }
  if (typeof data.token === 'string')
    auth.token = data.token
  if (typeof data.username === 'string')
    auth.username = data.username
  if (typeof data.password === 'string')
    auth.password = data.password

  return auth
}

export interface ParsedRequestFile {
  body: string
  description: string
  frontmatter: HttpRequestFrontmatter
  hasFrontmatter: boolean
  normalized: {
    method: HttpMethod
    url: string
    headers: HttpHeaderEntry[]
    query: HttpQueryEntry[]
    bodyType: HttpBodyType
    body: string | null
    formData: HttpFormDataEntry[]
    auth: HttpAuth
  }
}

export function parseRequestFile(source: string): ParsedRequestFile {
  const { body, frontmatter, hasFrontmatter } = splitFrontmatter(source)
  const fm = frontmatter

  return {
    body,
    description: body,
    frontmatter: fm,
    hasFrontmatter,
    normalized: {
      method: normalizeMethod(fm.method),
      url: typeof fm.url === 'string' ? fm.url : '',
      headers: normalizeHeaders(fm.headers),
      query: normalizeQuery(fm.query),
      bodyType: normalizeBodyType(fm.bodyType),
      body: typeof fm.body === 'string' ? fm.body : null,
      formData: normalizeFormData(fm.formData),
      auth: normalizeAuth(fm.auth),
    },
  }
}

export function serializeRequestFile(record: HttpRequestRecord): string {
  const frontmatter: HttpRequestFrontmatter = {
    id: record.id,
    name: record.name,
    folderId: record.folderId,
    method: record.method,
    url: record.url,
    headers: record.headers,
    query: record.query,
    bodyType: record.bodyType,
    body: record.body,
    formData: record.formData,
    auth: record.auth,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }

  const text = yaml
    .dump(frontmatter, { lineWidth: -1, noRefs: true, sortKeys: false })
    .trim()

  if (!record.description) {
    return `---\n${text}\n---\n`
  }

  return `---\n${text}\n---\n${record.description}`
}

export function readRequestFile(
  httpRoot: string,
  filePath: string,
): ParsedRequestFile | null {
  const absolutePath = path.join(httpRoot, filePath)
  if (!fs.pathExistsSync(absolutePath)) {
    return null
  }

  const source = fs.readFileSync(absolutePath, 'utf8')
  return parseRequestFile(source)
}

export function writeRequestFile(
  httpRoot: string,
  record: HttpRequestRecord,
): void {
  const absolutePath = path.join(httpRoot, record.filePath)
  const next = serializeRequestFile(record)

  if (fs.pathExistsSync(absolutePath)) {
    const current = fs.readFileSync(absolutePath, 'utf8')
    if (current === next) {
      return
    }
  }

  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, next, 'utf8')
}
