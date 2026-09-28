import type { McpServer } from '@modelcontextprotocol/server'
import type { HttpFoldersStorage } from '../../storage/contracts'
import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import {
  beginHttpExecution,
  finishHttpExecution,
} from '../../http/runtime/session'
import { useHttpStorage } from '../../storage'
import { PartialCreateError } from '../../storage/partialCreateError'
import { getHttpItem, httpMetadata, mcpHttpRuntime } from './httpItems'
import { registerHttpSavedTools } from './httpSaved'
import {
  CONTENT_LIMIT,
  failure,
  notifyStorageSynced,
  result,
  safely,
  storageFailure,
} from './results'

export { getHttpItem, httpMetadata, searchHttpItems } from './httpItems'

const entrySchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional(),
  description: z.string().optional(),
})
const createSchema = {
  name: z.string().trim().min(1).max(255),
  folderId: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .default(null),
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    .default('GET'),
  url: z.string().trim().min(1),
  headers: z.array(entrySchema).default([]),
  query: z.array(entrySchema).default([]),
  bodyType: z
    .enum(['none', 'json', 'graphql', 'text', 'form-urlencoded'])
    .default('none'),
  body: z.string().nullable().default(null),
  description: z.string().default(''),
}

type HttpCollection = Pick<
  ReturnType<HttpFoldersStorage['getFoldersTree']>[number],
  'id' | 'name' | 'parentId'
> & { children: HttpCollection[] }

function httpCollectionMetadata(
  folder: ReturnType<HttpFoldersStorage['getFoldersTree']>[number],
): HttpCollection {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    children: folder.children.map(httpCollectionMetadata),
  }
}

export function registerHttpTools(server: McpServer) {
  registerHttpSavedTools(server)
  server.registerTool(
    'list_http_collections',
    {
      description:
        'List HTTP collections and nested folders as a tree of id, name, parentId and children. Excludes configuration, secrets, requests and the virtual Inbox group. Use a returned ID as folderId in create_http_request.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    () =>
      safely(() =>
        useHttpStorage().folders.getFoldersTree().map(httpCollectionMetadata),
      ),
  )

  server.registerTool(
    'list_http_requests',
    {
      description:
        'List saved HTTP request metadata without sending requests. Omit folderId for all HTTP requests; pass null for Inbox, or a collection/folder ID for its direct requests only (not nested folders). Excludes trash and WebSocket requests. Sorted by updatedAt descending, then ID ascending. Supports offset and limit (default 20, maximum 100); returns items, hasMore and nextOffset. Use get_item for full content.',
      inputSchema: {
        folderId: z
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .nullable()
          .optional(),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ folderId, offset, limit }) =>
      safely(() => {
        const items = useHttpStorage()
          .requests
          .getRequests({
            isDeleted: 0,
            ...(folderId === null ? { isInbox: 1 } : { folderId }),
          })
          .filter(item => !item.isDeleted && item.protocol !== 'websocket')
          .sort((a, b) => b.updatedAt - a.updatedAt || a.id - b.id)
        const page = items.slice(offset, offset + limit).map(httpMetadata)
        const hasMore = offset + page.length < items.length
        return {
          items: page,
          hasMore,
          nextOffset: hasMore ? offset + page.length : null,
        }
      }, 'HTTP request list JSON exceeds the 2 MiB limit. Reduce limit and retry; a single oversized item cannot be returned.'),
  )

  server.registerTool(
    'create_http_collection',
    {
      description:
        'Create a top-level HTTP collection. Use the returned ID as folderId in create_http_request to add requests to it.',
      inputSchema: { name: z.string().trim().min(1).max(255) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ name }) => {
      if (getEntryNameValidationIssue(name))
        return failure('INVALID_NAME', 'The item name is invalid.')
      try {
        const { id } = useHttpStorage().folders.createFolder({
          name,
          parentId: null,
        })
        notifyStorageSynced()
        return result({ type: 'http_collection', id })
      }
      catch (error) {
        return storageFailure(error)
      }
    },
  )

  server.registerTool(
    'create_http_request',
    {
      description:
        'Save an HTTP request without sending it. Provide folderId for a root HTTP collection or nested folder; omit it or pass null to save without a collection (Inbox). Requests in a collection inherit its authorization. Supports text bodies, headers, query parameters and {{variables}}. Body plus description is limited to 256 KiB UTF-8. On PARTIAL_CREATE inspect the returned ID; do not retry creation.',
      inputSchema: createSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (input) => {
      if (getEntryNameValidationIssue(input.name))
        return failure('INVALID_NAME', 'The item name is invalid.')
      if (
        Buffer.byteLength(input.body ?? '', 'utf8')
        + Buffer.byteLength(input.description, 'utf8')
        > CONTENT_LIMIT
      ) {
        return failure(
          'CONTENT_TOO_LARGE',
          'Body plus description exceeds the 256 KiB limit.',
        )
      }
      let id: number | undefined
      try {
        const { requests } = useHttpStorage()
        id = requests.createRequest({
          name: input.name,
          method: input.method,
          url: input.url,
          folderId: input.folderId,
          protocol: 'http',
        }).id
        const update = requests.updateRequest(id, {
          headers: input.headers,
          query: input.query,
          bodyType: input.bodyType,
          body: input.body,
          description: input.description,
        })
        if (update.invalidInput || update.notFound)
          throw new Error('STORAGE_ERROR')
        return result({ type: 'http_request', id })
      }
      catch (error) {
        if (error instanceof PartialCreateError)
          id = error.itemId
        return id === undefined
          ? storageFailure(error)
          : failure(
              'PARTIAL_CREATE',
              'The request was created, but saving did not complete. Inspect this ID; do not retry creation automatically.',
              false,
              { type: 'http_request', id },
            )
      }
      finally {
        if (id !== undefined)
          notifyStorageSynced()
      }
    },
  )

  server.registerTool(
    'execute_http_request',
    {
      description:
        'Send a saved HTTP request by ID using the active massCode environment, collection configuration, cookies, protected secrets and trusted scripts. Can change remote data and local HTTP session/history. Requires user intent to send this request. Does not grant script trust or upload local files. Response body is capped at 256 KiB; execution at 60 seconds. Never retry automatically after an uncertain outcome.',
      inputSchema: {
        id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id }, ctx) => {
      const { executeHttpRequest } = await import('../../http/runtime/execute')
      if (!beginHttpExecution()) {
        return failure(
          'HTTP_REQUEST_RUNNING',
          'Another HTTP request or collection run is in progress.',
        )
      }
      try {
        const item = getHttpItem(id)
        if (item.runtimeState !== 'ready') {
          return failure(
            'HTTP_RUNTIME_UNAVAILABLE',
            'Open this request in massCode and resolve its runtime configuration before sending.',
          )
        }
        if (
          item.bodyType === 'binary'
          || (item.bodyType === 'multipart'
            && item.formData.some(
              entry => entry.type === 'file' && entry.enabled !== false,
            ))
        ) {
          return failure(
            'FILE_UPLOAD_UNSUPPORTED',
            'Send requests that upload local files from the massCode app.',
          )
        }
        const runtime = mcpHttpRuntime(item.runtime)
        const controller = new AbortController()
        const abort = () => controller.abort()
        ctx.mcpReq.signal.addEventListener('abort', abort, { once: true })
        if (ctx.mcpReq.signal.aborted)
          abort()
        const timer = setTimeout(abort, 60_000)
        try {
          const response = await executeHttpRequest(
            {
              request: item,
              requestId: id,
              environmentId:
                useHttpStorage().environments.getActiveEnvironmentId(),
              runtime,
            },
            undefined,
            controller.signal,
          )
          const output = result(
            {
              type: 'http_request',
              id,
              ...response,
              historyId: response.historyId ?? null,
            },
            'The request was sent, but the result exceeds 2 MiB. Inspect HTTP history in massCode; do not resend automatically.',
          )
          if (response.error || response.discarded)
            output.isError = true
          return output
        }
        catch {
          return failure(
            'HTTP_EXECUTION_FAILED',
            'Execution did not complete normally. The server may have processed the request. Inspect HTTP history; do not resend automatically.',
            false,
            { type: 'http_request', id },
          )
        }
        finally {
          clearTimeout(timer)
          ctx.mcpReq.signal.removeEventListener('abort', abort)
        }
      }
      catch (error) {
        return storageFailure(error)
      }
      finally {
        finishHttpExecution()
      }
    },
  )
}
