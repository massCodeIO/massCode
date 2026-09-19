import type { CallToolResult } from '@modelcontextprotocol/server'
import type { NoteRecord, SnippetRecord } from '../../storage/contracts'
import type { httpMetadata } from './http'
import { Buffer } from 'node:buffer'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { useNotesStorage, useStorage } from '../../storage'
import { PartialCreateError } from '../../storage/partialCreateError'
import { getHttpItem, registerHttpTools, searchHttpItems } from './http'
import {
  CONTENT_LIMIT,
  failure,
  notifyStorageSynced,
  result,
  safely,
  storageFailure,
} from './results'

const itemType = z.enum(['snippet', 'note', 'http_request'])
const nameSchema = z.string().trim().min(1).max(255)
const contentSchema = z.string()
const languageSchema = z
  .string()
  .regex(/^[^\r\n`]+$/, 'Language must be a single line without backticks.')
  .trim()
  .min(1)
  .max(128)
  .default('plain_text')

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
        'Search local snippets and notes by name and full text, and HTTP requests by name or URL. Returns metadata only, excluding trash. Results are sorted by updatedAt descending, type ascending, then id ascending.',
      inputSchema: {
        query: z.string().trim().min(1).max(4096),
        type: z.enum(['snippet', 'note', 'http_request', 'all']).default('all'),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, type, offset, limit }) =>
      safely(async () => {
        const filter = { search: query, isDeleted: 0 }
        const items: (
          | ReturnType<typeof metadata>
          | ReturnType<typeof httpMetadata>
        )[] = []
        if (type === 'snippet' || type === 'all') {
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
        if (type === 'note' || type === 'all') {
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
        if (type === 'http_request' || type === 'all') {
          items.push(...searchHttpItems(query))
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
        'Get a complete local note, snippet with all fragments, or saved HTTP request, up to 256 KiB of combined UTF-8 content and 2 MiB of result JSON. IDs are scoped by type. Trash is excluded. Cloud placeholders return a retryable error; oversized results are never truncated.',
      inputSchema: {
        type: itemType,
        id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ type, id }) =>
      safely(() => {
        if (type === 'http_request')
          return getHttpItem(id)
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

  registerHttpTools(server)

  return server
}
