import type { McpServer } from '@modelcontextprotocol/server'
import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { emptyHttpRuntime } from '../../../shared/httpRuntime'
import {
  beginHttpExecution,
  finishHttpExecution,
} from '../../http/runtime/session'
import { useHttpStorage } from '../../storage'
import { PartialCreateError } from '../../storage/partialCreateError'
import {
  CONTENT_LIMIT,
  failure,
  notifyStorageSynced,
  result,
  storageFailure,
} from './results'

const entrySchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional(),
  description: z.string().optional(),
})
const createSchema = {
  name: z.string().trim().min(1).max(255),
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

type HttpItem = NonNullable<
  ReturnType<ReturnType<typeof useHttpStorage>['requests']['getRequestById']>
>

export function httpMetadata(
  item: Pick<
    HttpItem,
    | 'id'
    | 'name'
    | 'method'
    | 'url'
    | 'folderId'
    | 'createdAt'
    | 'updatedAt'
    | 'pendingCloudDownload'
  >,
) {
  return {
    type: 'http_request' as const,
    id: item.id,
    name: item.name,
    method: item.method,
    url: item.url,
    folderId: item.folderId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    pendingCloudDownload: item.pendingCloudDownload === true,
  }
}

export function searchHttpItems(query: string) {
  return useHttpStorage()
    .requests
    .getRequests({ search: query, isDeleted: 0 })
    .filter(item => !item.isDeleted && item.protocol !== 'websocket')
    .map(httpMetadata)
}

export function getHttpItem(id: number) {
  const item = useHttpStorage().requests.getRequestById(id)
  if (!item || item.isDeleted || item.protocol === 'websocket')
    throw new Error('HTTP_REQUEST_NOT_FOUND')
  if (item.pendingCloudDownload)
    throw new Error('CLOUD_FILE_NOT_DOWNLOADED')
  if (
    Buffer.byteLength(item.body ?? '', 'utf8')
    + Buffer.byteLength(item.description, 'utf8')
    > CONTENT_LIMIT
  ) {
    throw new Error('CONTENT_TOO_LARGE')
  }
  return { type: 'http_request' as const, ...item }
}

export function registerHttpTools(server: McpServer) {
  server.registerTool(
    'create_http_request',
    {
      description:
        'Save an HTTP request to HTTP Inbox without sending it. Supports text bodies, headers, query parameters and {{variables}}. Body plus description is limited to 256 KiB UTF-8. On PARTIAL_CREATE inspect the returned ID; do not retry creation.',
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
          folderId: null,
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
        const runtime = item.runtime ?? emptyHttpRuntime()
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
              runtime: {
                ...runtime,
                transport: {
                  ...runtime.transport,
                  maxResponseBytes: Math.min(
                    runtime.transport?.maxResponseBytes || CONTENT_LIMIT,
                    CONTENT_LIMIT,
                  ),
                  timeoutMs: Math.min(
                    runtime.transport?.timeoutMs || 30_000,
                    60_000,
                  ),
                },
              },
            },
            undefined,
            controller.signal,
          )
          const output = result(
            { type: 'http_request', id, ...response },
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
