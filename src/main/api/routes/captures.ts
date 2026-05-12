import type { CaptureRequest, CaptureResponse } from '../dto/captures'
import { BrowserWindow } from 'electron'
import { Elysia } from 'elysia'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { useHttpStorage, useNotesStorage, useStorage } from '../../storage'
import { capturesDTO } from '../dto/captures'
import { commonMessageResponse } from '../dto/common/response'
import { isIntegrationTokenAuthorized } from '../integrations/auth'

const app = new Elysia({ prefix: '/captures' })
const INVALID_CAPTURE_NAME_CHARS = new Set([
  '#',
  '[',
  ']',
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '^',
  '|',
  '?',
  '*',
])

function parseStorageError(
  error: unknown,
): { code: string, message: string } | null {
  if (!(error instanceof Error)) {
    return null
  }

  const separatorIndex = error.message.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    code: error.message.slice(0, separatorIndex),
    message: error.message.slice(separatorIndex + 1).trim(),
  }
}

function mapStorageError(status: unknown, error: unknown): never {
  const setStatus = status as (
    code: number,
    payload: { message: string },
  ) => never
  const parsedError = parseStorageError(error)

  if (!parsedError) {
    return setStatus(500, { message: 'Internal storage error' })
  }

  if (parsedError.code === 'NAME_CONFLICT') {
    return setStatus(409, { message: parsedError.message })
  }

  if (parsedError.code === 'FOLDER_NOT_FOUND') {
    return setStatus(404, { message: parsedError.message })
  }

  if (
    parsedError.code === 'INVALID_NAME'
    || parsedError.code === 'RESERVED_NAME'
  ) {
    return setStatus(400, { message: parsedError.message })
  }

  return setStatus(500, {
    message: parsedError.message || 'Internal storage error',
  })
}

function trimToValue(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function getUrlHost(url?: string): string | undefined {
  if (!url) {
    return undefined
  }

  try {
    return new URL(url).hostname
  }
  catch {
    return undefined
  }
}

function getHttpNameFromUrl(url?: string, method = 'GET'): string | undefined {
  if (!url) {
    return undefined
  }

  try {
    const parsedUrl = new URL(url)
    const path
      = parsedUrl.pathname === '/' ? parsedUrl.hostname : parsedUrl.pathname

    return `${method} ${path}`
  }
  catch {
    return undefined
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextIndexedName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim()
  const indexedNameRe = new RegExp(
    `^${escapeRegExp(normalizedBase)}(?:\\s+(\\d+))?$`,
    'i',
  )

  let maxIndex = 0
  existingNames.forEach((name) => {
    const match = name.trim().match(indexedNameRe)
    if (!match) {
      return
    }

    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })

  return `${normalizedBase} ${maxIndex + 1}`
}

function getUniqueName(baseName: string, existingNames: string[]): string {
  const normalizedBase = sanitizeCaptureName(baseName, 'Captured item')
  const hasConflict = existingNames.some(
    name => name.trim().toLowerCase() === normalizedBase.toLowerCase(),
  )

  return hasConflict
    ? getNextIndexedName(normalizedBase, existingNames)
    : normalizedBase
}

function sanitizeCaptureName(name: string, fallback: string): string {
  let sanitized = Array.from(name)
    .map(char =>
      INVALID_CAPTURE_NAME_CHARS.has(char) || char.charCodeAt(0) <= 0x1F
        ? ' '
        : char,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  sanitized = sanitized.replace(/^\.+/, '').replace(/\.+$/, '').trim()

  if (!sanitized) {
    sanitized = fallback
  }

  const issue = getEntryNameValidationIssue(sanitized)

  if (issue?.code === 'windowsReserved') {
    return `${sanitized} capture`
  }

  return issue ? fallback : sanitized
}

function resolveCaptureName(body: CaptureRequest, fallback: string): string {
  const sourceTitle
    = trimToValue(body.sourceTitle)
      ?? trimToValue(body.source?.title)
      ?? trimToValue(body.pageTitle)
  const sourceUrl
    = trimToValue(body.sourceUrl)
      ?? trimToValue(body.source?.url)
      ?? trimToValue(body.url)
  const explicitName = trimToValue(body.name)

  if (explicitName) {
    return explicitName
  }

  if (body.target === 'http') {
    const requestUrl = trimToValue(body.url) ?? sourceUrl

    return (
      trimToValue(body.suggestedName)
      ?? getHttpNameFromUrl(requestUrl, body.method ?? 'GET')
      ?? trimToValue(body.contextLabel)
      ?? getUrlHost(requestUrl)
      ?? fallback
    )
  }

  if (body.target === 'code') {
    return (
      trimToValue(body.suggestedName)
      ?? trimToValue(body.contextLabel)
      ?? sourceTitle
      ?? getUrlHost(sourceUrl)
      ?? fallback
    )
  }

  return (
    trimToValue(body.suggestedName)
    ?? sourceTitle
    ?? trimToValue(body.contextLabel)
    ?? getUrlHost(sourceUrl)
    ?? fallback
  )
}

function resolveCapturedAt(body: CaptureRequest): string {
  const capturedAt = body.source?.capturedAt
  const date
    = typeof capturedAt === 'number' && Number.isFinite(capturedAt)
      ? new Date(capturedAt)
      : new Date()

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    second: '2-digit',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(date)
}

function createSourceDescription(body: CaptureRequest): string {
  const title
    = trimToValue(body.sourceTitle)
      ?? trimToValue(body.source?.title)
      ?? trimToValue(body.pageTitle)
  const url
    = trimToValue(body.sourceUrl)
      ?? trimToValue(body.source?.url)
      ?? trimToValue(body.url)
  const lines: string[] = []

  if (url) {
    lines.push(`Captured from: ${title ? `${title} (${url})` : url}`)
  }

  const contextLabel = trimToValue(body.contextLabel)
  if (contextLabel) {
    lines.push(`Context: ${contextLabel}`)
  }

  lines.push(`Captured at: ${resolveCapturedAt(body)}`)

  return lines.join('\n')
}

function getCodeFence(text: string): string {
  const matches = text.match(/`{3,}/g)
  if (!matches) {
    return '```'
  }

  const length = Math.max(...matches.map(match => match.length)) + 1

  return '`'.repeat(length)
}

function getMarkdownFenceLanguage(body: CaptureRequest): string | undefined {
  const sourceName
    = trimToValue(body.contextLabel)
      ?? trimToValue(body.sourceTitle)
      ?? trimToValue(body.source?.title)
      ?? trimToValue(body.pageTitle)

  if (!sourceName) {
    return undefined
  }

  const extension = sourceName.match(/\.([a-z0-9]+)(?:$|[\s?#])/i)?.[1]
  if (!extension) {
    return undefined
  }

  const languages: Record<string, string> = {
    cjs: 'js',
    css: 'css',
    html: 'html',
    js: 'js',
    json: 'json',
    jsx: 'jsx',
    md: 'md',
    mjs: 'js',
    sh: 'sh',
    ts: 'ts',
    tsx: 'tsx',
    vue: 'vue',
    yaml: 'yaml',
    yml: 'yaml',
  }

  return languages[extension.toLowerCase()]
}

function createNoteContent(body: CaptureRequest): string {
  const text = trimToValue(body.text)
  const markdown = trimToValue(body.markdown)
  const title
    = trimToValue(body.sourceTitle)
      ?? trimToValue(body.source?.title)
      ?? trimToValue(body.pageTitle)
  const url
    = trimToValue(body.sourceUrl)
      ?? trimToValue(body.source?.url)
      ?? trimToValue(body.url)
  const lines: string[] = []
  const sourceLines: string[] = []

  if (markdown) {
    lines.push(markdown, '')
  }
  else if (text) {
    const language = getMarkdownFenceLanguage(body)

    if (language) {
      const fence = getCodeFence(text)

      lines.push(`${fence}${language}`, text, fence, '')
    }
    else {
      lines.push(text, '')
    }
  }

  if (url) {
    if (title) {
      sourceLines.push(`Source: ${title}`)
      sourceLines.push(`URL: ${url}`)
    }
    else {
      sourceLines.push(`Source: ${url}`)
    }
  }

  const contextLabel = trimToValue(body.contextLabel)
  if (contextLabel) {
    sourceLines.push(`Context: ${contextLabel}`)
  }

  sourceLines.push(`Captured: ${resolveCapturedAt(body)}`)
  lines.push(...sourceLines.map(line => `> ${line}`))

  return lines.join('\n')
}

function getCaptureValidationMessage(body: CaptureRequest): string | null {
  if (body.target === 'code' && !trimToValue(body.text)) {
    return 'Code capture requires selected text'
  }

  if (
    body.target === 'notes'
    && !trimToValue(body.text)
    && !trimToValue(body.markdown)
  ) {
    return 'Notes capture requires text or markdown content'
  }

  return null
}

function notifyStorageSynced(): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('system:storage-synced')
  })
}

function createCodeCapture(body: CaptureRequest): CaptureResponse {
  const storage = useStorage()
  const folderId = body.folderId ?? null
  const siblings = storage.snippets.getSnippets({
    isDeleted: 0,
    ...(folderId === null ? { isInbox: 1 } : { folderId }),
  })
  const name = getUniqueName(
    resolveCaptureName(body, 'Captured snippet'),
    siblings.map(item => item.name),
  )
  const { id } = storage.snippets.createSnippet({ folderId, name })

  storage.snippets.createSnippetContent(id, {
    label: name,
    language: trimToValue(body.language) ?? 'plain_text',
    value: body.text ?? '',
  })

  const description = createSourceDescription(body)
  if (description) {
    storage.snippets.updateSnippet(id, { description })
  }

  return { id, target: 'code' }
}

function createNotesCapture(body: CaptureRequest): CaptureResponse {
  const storage = useNotesStorage()
  const folderId = body.folderId ?? null
  const siblings = storage.notes.getNotes({
    isDeleted: 0,
    ...(folderId === null ? { isInbox: 1 } : { folderId }),
  })
  const name = getUniqueName(
    resolveCaptureName(body, 'Captured note'),
    siblings.map(item => item.name),
  )
  const { id } = storage.notes.createNote({ folderId, name })

  storage.notes.updateNoteContent(id, createNoteContent(body))

  return { id, target: 'notes' }
}

function createHttpCapture(body: CaptureRequest): CaptureResponse {
  const storage = useHttpStorage()
  const folderId = body.folderId ?? null
  const siblings = storage.requests.getRequests({
    isDeleted: 0,
    ...(folderId === null ? { isInbox: 1 } : { folderId }),
  })
  const url = trimToValue(body.url) ?? trimToValue(body.source?.url) ?? ''
  const name = getUniqueName(
    resolveCaptureName(body, 'Captured request'),
    siblings.map(item => item.name),
  )
  const { id } = storage.requests.createRequest({
    folderId,
    method: body.method ?? 'GET',
    name,
    url,
  })

  const description = createSourceDescription(body)
  if (description) {
    storage.requests.updateRequest(id, { description })
  }

  return { id, target: 'http' }
}

app.use(capturesDTO).post(
  '/',
  ({ body, headers, status }) => {
    if (!isIntegrationTokenAuthorized(headers.authorization)) {
      return status(401, { message: 'Unauthorized integration request' })
    }

    const validationMessage = getCaptureValidationMessage(body)
    if (validationMessage) {
      return status(400, { message: validationMessage })
    }

    try {
      const result
        = body.target === 'code'
          ? createCodeCapture(body)
          : body.target === 'notes'
            ? createNotesCapture(body)
            : createHttpCapture(body)

      notifyStorageSynced()

      return result
    }
    catch (error) {
      return mapStorageError(status, error)
    }
  },
  {
    body: 'captureRequest',
    response: {
      200: 'captureResponse',
      400: commonMessageResponse,
      401: commonMessageResponse,
      404: commonMessageResponse,
      409: commonMessageResponse,
      500: commonMessageResponse,
    },
    detail: {
      tags: ['Captures'],
    },
  },
)

export default app
