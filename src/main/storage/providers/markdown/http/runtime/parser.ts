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
import { log } from '../../../../../utils'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { normalizeFlag } from '../../runtime/normalizers'
import { getFileAvailability } from '../../runtime/shared/cloudFiles'
import { throwCloudContentUnavailable } from '../../runtime/shared/cloudGuards'

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

export function normalizeMethod(value: unknown): HttpMethod {
  if (typeof value !== 'string') {
    return 'GET'
  }

  const upper = value.toUpperCase() as HttpMethod
  return HTTP_METHODS.includes(upper) ? upper : 'GET'
}

export function normalizeBodyType(value: unknown): HttpBodyType {
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

function pickKvExtras(entry: Record<string, unknown>): {
  description?: string
  enabled?: boolean
} {
  const extras: { description?: string, enabled?: boolean } = {}
  if (typeof entry.description === 'string') {
    extras.description = entry.description
  }
  if (typeof entry.enabled === 'boolean') {
    extras.enabled = entry.enabled
  }
  return extras
}

function normalizeHeaders(raw: unknown): HttpHeaderEntry[] {
  return normalizeKeyValueEntries<HttpHeaderEntry>(raw, pickKvExtras)
}

function normalizeQuery(raw: unknown): HttpQueryEntry[] {
  return normalizeKeyValueEntries<HttpQueryEntry>(raw, pickKvExtras)
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
    isDeleted: number
    isFavorites: number
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
      isDeleted: normalizeFlag(fm.isDeleted),
      isFavorites: normalizeFlag(fm.isFavorites),
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
    isFavorites: record.isFavorites,
    isDeleted: record.isDeleted,
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
  const availability = getFileAvailability(absolutePath)

  if (!availability.exists) {
    return null
  }

  // Недокачанный файл не читается синхронно: он уходит в фоновую докачку,
  // после которой запрос появится через повторный sync.
  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    return null
  }

  const source = fs.readFileSync(absolutePath, 'utf8')
  return parseRequestFile(source)
}

// Дочитывает body и description записи, построенной из индекса. Остальные
// поля runtime-записи авторитетны и могут содержать ещё не сохранённые
// правки. Возвращает false, если содержимое сейчас недоступно
// (плейсхолдер, сбой чтения).
export function ensureRequestDetailsLoaded(
  httpRoot: string,
  record: HttpRequestRecord,
): boolean {
  if (!record.detailsPending) {
    return true
  }

  const absolutePath = path.join(httpRoot, record.filePath)
  const availability = getFileAvailability(absolutePath)

  if (!availability.exists) {
    return false
  }

  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    return false
  }

  let source: string
  try {
    source = fs.readFileSync(absolutePath, 'utf8')
  }
  catch (error) {
    log('storage:http:load-request-details', error)
    enqueueCloudDownload(absolutePath)
    return false
  }

  const parsed = parseRequestFile(source)
  record.body = parsed.normalized.body
  record.description = parsed.description
  delete record.detailsPending

  return true
}

export function writeRequestFile(
  httpRoot: string,
  record: HttpRequestRecord,
): void {
  const absolutePath = path.join(httpRoot, record.filePath)
  const availability = getFileAvailability(absolutePath)

  // Запись в недокачанный файл затёрла бы облачное содержимое: файл сначала
  // докачивается в фоне.
  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    return
  }

  // Ленивая запись (body/description ещё не дочитаны из индекса): они
  // дочитываются перед сериализацией, иначе запись затёрла бы их пустыми.
  // Тихий пропуск записи потерял бы правку метаданных при следующем скане,
  // поэтому сбой поднимается наверх. В scan-путях (write-back после чтения)
  // запись уже прочитана и ветка недостижима.
  if (!ensureRequestDetailsLoaded(httpRoot, record)) {
    throwCloudContentUnavailable()
  }

  const next = serializeRequestFile(record)

  if (availability.exists) {
    const current = fs.readFileSync(absolutePath, 'utf8')
    if (current === next) {
      return
    }
  }

  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, next, 'utf8')
}
