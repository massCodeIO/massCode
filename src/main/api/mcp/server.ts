import type { CallToolResult } from '@modelcontextprotocol/server'
import type { NoteRecord, SnippetRecord } from '../../storage/contracts'
import { Buffer } from 'node:buffer'
import { McpServer } from '@modelcontextprotocol/server'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { useNotesStorage, useStorage } from '../../storage'
import { PartialCreateError } from '../../storage/partialCreateError'

const CONTENT_LIMIT = 256 * 1024
const RESULT_LIMIT = 2 * 1024 * 1024
const itemType = z.enum(['snippet', 'note'])
const nameSchema = z.string().trim().min(1).max(255)
const contentSchema = z.string()
const languageSchema = z
  .string()
  .regex(/^[^\r\n`]+$/, 'Language must be a single line without backticks.')
  .trim()
  .min(1)
  .max(128)
  .default('plain_text')

function failure(
  code: string,
  message: string,
  retryable = false,
  extra = {},
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ code, message, retryable, ...extra }),
      },
    ],
  }
}

function result(
  value: unknown,
  oversizedMessage = 'Result JSON exceeds the 2 MiB limit.',
): CallToolResult {
  const text = JSON.stringify(value)
  if (Buffer.byteLength(text, 'utf8') > RESULT_LIMIT) {
    return failure('CONTENT_TOO_LARGE', oversizedMessage)
  }
  return { content: [{ type: 'text', text }] }
}

function storageFailure(error: unknown): CallToolResult {
  const code = error instanceof Error ? error.message.split(':')[0] : ''
  switch (code) {
    case 'CONTENT_TOO_LARGE':
      return failure(
        code,
        'Combined item content exceeds the 256 KiB UTF-8 limit.',
      )
    case 'VAULT_HYDRATING':
    case 'CLOUD_FILE_NOT_DOWNLOADED':
      return failure(
        code,
        'Content is not locally available yet. Retry after download completes.',
        true,
      )
    case 'NAME_CONFLICT':
      return failure(code, 'An item with this name already exists.')
    case 'INVALID_NAME':
    case 'RESERVED_NAME':
      return failure(code, 'The item name is invalid.')
    case 'NOTE_NOT_FOUND':
    case 'SNIPPET_NOT_FOUND':
    case 'FOLDER_NOT_FOUND':
      return failure('NOT_FOUND', 'Item not found.')
    default:
      return failure('STORAGE_ERROR', 'The storage operation failed.')
  }
}

async function safely(
  operation: () => unknown | Promise<unknown>,
  oversizedMessage?: string,
): Promise<CallToolResult> {
  try {
    return result(await operation(), oversizedMessage)
  }
  catch (error) {
    return storageFailure(error)
  }
}

function metadata(type: 'snippet' | 'note', item: SnippetRecord | NoteRecord) {
  return {
    type,
    id: item.id,
    name: item.name,
    folder: item.folder,
    tags: item.tags,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    languages:
      'contents' in item
        ? [...new Set(item.contents.map(content => content.language))]
        : ['markdown'],
    pendingCloudDownload: item.pendingCloudDownload === true,
  }
}

function notifyStorageSynced(): void {
  // A closed window must not turn a completed write into a retryable failure.
  try {
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send('system:storage-synced')
      }
      catch {}
    }
  }
  catch {}
}

function createItem(
  type: 'snippet' | 'note',
  name: string,
  content: string,
  language = 'plain_text',
): CallToolResult {
  if (getEntryNameValidationIssue(name)) {
    return failure('INVALID_NAME', 'The item name is invalid.')
  }
  if (Buffer.byteLength(content, 'utf8') > CONTENT_LIMIT) {
    return failure('CONTENT_TOO_LARGE', 'Content exceeds the 256 KiB limit.')
  }

  let id: number | undefined
  try {
    if (type === 'snippet') {
      const { snippets } = useStorage()
      id = snippets.createSnippet({ name, folderId: null }).id
      snippets.createSnippetContent(id, {
        label: name,
        language,
        value: content,
      })
    }
    else {
      const { notes } = useNotesStorage()
      id = notes.createNote({ name, folderId: null }).id
      const update = notes.updateNoteContent(id, content)
      if (update.invalidInput || update.notFound) {
        throw new Error('STORAGE_ERROR')
      }
    }
    return result({ type, id })
  }
  catch (error) {
    if (error instanceof PartialCreateError) {
      id = error.itemId
    }
    if (id !== undefined) {
      return failure(
        'PARTIAL_CREATE',
        'The item was created, but saving did not complete. Inspect this item; do not retry creation automatically.',
        false,
        { type, id },
      )
    }
    return storageFailure(error)
  }
  finally {
    if (id !== undefined) {
      notifyStorageSynced()
    }
  }
}

export function createServer(version: string): McpServer {
  const server = new McpServer({ name: 'massCode', version })

  server.registerTool(
    'search',
    {
      description:
        'Search local snippets and notes by name and full text. Returns metadata only, excluding trash. Results are sorted by updatedAt descending, type ascending, then id ascending.',
      inputSchema: {
        query: z.string().trim().min(1).max(4096),
        type: z.enum(['snippet', 'note', 'all']).default('all'),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, type, offset, limit }) =>
      safely(async () => {
        const filter = { search: query, isDeleted: 0 }
        const items: ReturnType<typeof metadata>[] = []
        if (type !== 'note') {
          const { snippets } = useStorage()
          const found = snippets.getSnippetsAsync
            ? await snippets.getSnippetsAsync(filter)
            : snippets.getSnippets(filter)
          items.push(
            ...found
              .filter(item => !item.isDeleted)
              .map(item => metadata('snippet', item)),
          )
        }
        if (type !== 'snippet') {
          const { notes } = useNotesStorage()
          const found = notes.getNotesAsync
            ? await notes.getNotesAsync(filter)
            : notes.getNotes(filter)
          items.push(
            ...found
              .filter(item => !item.isDeleted)
              .map(item => metadata('note', item)),
          )
        }
        items.sort(
          (a, b) =>
            b.updatedAt - a.updatedAt
            || a.type.localeCompare(b.type)
            || a.id - b.id,
        )
        const page = items.slice(offset, offset + limit)
        const hasMore = offset + page.length < items.length
        return {
          items: page,
          hasMore,
          nextOffset: hasMore ? offset + page.length : null,
        }
      }, 'Search result JSON exceeds the 2 MiB limit. Reduce limit and retry; a single oversized item cannot be returned.'),
  )

  server.registerTool(
    'get_item',
    {
      description:
        'Get a complete local note or snippet with all fragments, up to 256 KiB of combined UTF-8 content and 2 MiB of result JSON. IDs are scoped by type. Trash is excluded. Cloud placeholders return a retryable error; oversized results are never truncated.',
      inputSchema: {
        type: itemType,
        id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ type, id }) =>
      safely(() => {
        const item
          = type === 'snippet'
            ? useStorage().snippets.getSnippetById(id)
            : useNotesStorage().notes.getNoteById(id)
        if (!item || item.isDeleted) {
          throw new Error('NOTE_NOT_FOUND')
        }
        if (item.pendingCloudDownload) {
          throw new Error('CLOUD_FILE_NOT_DOWNLOADED')
        }
        const contentBytes
          = 'contents' in item
            ? item.contents.reduce(
                (size, fragment) =>
                  size + Buffer.byteLength(fragment.value ?? '', 'utf8'),
                0,
              )
            : Buffer.byteLength(item.content, 'utf8')
        if (contentBytes > CONTENT_LIMIT) {
          throw new Error('CONTENT_TOO_LARGE')
        }
        return { type, ...item }
      }),
  )

  server.registerTool(
    'create_snippet',
    {
      description:
        'Create one snippet with one fragment in Inbox. Content is preserved exactly, up to 256 KiB in UTF-8. On PARTIAL_CREATE inspect the returned item ID and do not retry creation.',
      inputSchema: {
        name: nameSchema,
        content: contentSchema,
        language: languageSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ name, content, language }) =>
      createItem('snippet', name, content, language),
  )

  server.registerTool(
    'create_note',
    {
      description:
        'Create one Markdown note in Inbox. Content is preserved exactly, up to 256 KiB in UTF-8. On PARTIAL_CREATE inspect the returned item ID and do not retry creation.',
      inputSchema: { name: nameSchema, content: contentSchema },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ name, content }) => createItem('note', name, content),
  )

  return server
}
