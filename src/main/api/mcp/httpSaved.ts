import type { McpServer } from '@modelcontextprotocol/server'
import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { httpCollectionSchema } from '../../../shared/httpCollection'
import { httpRequestPreview } from '../../http/requestPreview'
import { useHttpStorage } from '../../storage'
import { getHttpItem, mcpHttpRuntime } from './httpItems'
import { CONTENT_LIMIT, failure, notifyStorageSynced, safely } from './results'

const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const pagination = {
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.number().int().min(1).max(100).default(20),
}
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
const entry = z
  .object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().optional(),
    description: z.string().optional(),
  })
  .strict()
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    folderId: idSchema.nullable().optional(),
    method: z
      .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
      .optional(),
    url: z.string().trim().min(1).optional(),
    headers: z.array(entry).optional(),
    query: z.array(entry).optional(),
    bodyType: z
      .enum(['none', 'json', 'graphql', 'text', 'form-urlencoded'])
      .optional(),
    body: z.string().nullable().optional(),
    description: z.string().optional(),
    auth: httpCollectionSchema.shape.auth.strict().optional(),
  })
  .strict()
  .refine(
    patch => Object.keys(patch).length > 0,
    'Provide at least one field',
  )

export function registerHttpSavedTools(server: McpServer) {
  server.registerTool(
    'update_http_request',
    {
      description:
        'Update a saved HTTP request without sending it. Read get_item first and provide its contentRevision as expectedRevision. A stale revision returns CONFLICT; read and reconcile before retrying. Patch must be nonempty: omitted fields remain unchanged, arrays replace existing arrays, folderId null moves to Inbox. Moves preserve auth; set auth explicitly to change it. Supports text bodies only; no WebSocket, trash, runtime edits or local file uploads. Combined final body and description must fit 256 KiB UTF-8. Returns actual name, folderId and new contentRevision.',
      inputSchema: {
        id: idSchema,
        expectedRevision: z.string().min(1),
        patch: patchSchema,
      },
      annotations: {
        ...readOnly,
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    ({ id, expectedRevision, patch }) => {
      if (patch.name !== undefined && getEntryNameValidationIssue(patch.name))
        return failure('INVALID_NAME', 'The item name is invalid.')
      return safely(() => {
        const item = getHttpItem(id, false)
        if (
          patch.body !== undefined
          && ['binary', 'multipart'].includes(patch.bodyType ?? item.bodyType)
        ) {
          throw new Error('UNSUPPORTED_BODY_TYPE')
        }
        const body = patch.body === undefined ? item.body : patch.body
        const description = patch.description ?? item.description
        if (
          Buffer.byteLength(body ?? '', 'utf8')
          + Buffer.byteLength(description, 'utf8')
          > CONTENT_LIMIT
        ) {
          throw new Error('CONTENT_TOO_LARGE')
        }
        const storage = useHttpStorage().requests
        const updated = storage.updateRequest(id, {
          ...patch,
          expectedRevision,
        })
        if (updated.notFound)
          throw new Error('HTTP_REQUEST_NOT_FOUND')
        if (updated.invalidInput)
          throw new Error('INVALID_NAME')
        const actual = storage.getRequestById(id)!
        notifyStorageSynced()
        return {
          type: 'http_request',
          id,
          name: actual.name,
          folderId: actual.folderId,
          contentRevision: updated.contentRevision,
        }
      })
    },
  )

  server.registerTool(
    'preview_http_request',
    {
      description:
        'Preview a saved HTTP request using the active environment without sending it or running scripts. Returns masked pre-script/pre-transport configuration, not an exact wire capture: revision, resolved URL, effective auth type, counts, transport limits and script scopes/trust. No bodies, auth values, cookies, script source or protected/session secrets. Uses the same 60-second and 256 KiB response limits as MCP execution.',
      inputSchema: { id: idSchema },
      annotations: readOnly,
    },
    ({ id }) =>
      safely(() => {
        const item = getHttpItem(id)
        if (item.runtimeState !== 'ready')
          throw new Error('HTTP_RUNTIME_UNAVAILABLE')
        const environmentId
          = useHttpStorage().environments.getActiveEnvironmentId()
        return {
          ...httpRequestPreview({
            requestId: id,
            request: item,
            environmentId,
            runtime: mcpHttpRuntime(item.runtime),
          }),
          contentRevision: item.contentRevision,
          folderId: item.folderId,
          environmentId,
        }
      }),
  )

  server.registerTool(
    'list_http_history',
    {
      description:
        'List saved HTTP execution history metadata, optionally filtered by requestId. Sorted by requestedAt descending, then ID descending. Uses offset and limit (default 20, maximum 100); returns items, hasMore and nextOffset. No response bodies or snapshot file paths. Use get_http_history for a saved redacted snapshot.',
      inputSchema: { requestId: idSchema.optional(), ...pagination },
      annotations: readOnly,
    },
    ({ requestId, offset, limit }) =>
      safely(() => {
        const entries = useHttpStorage()
          .history
          .getEntries()
          .filter(
            item => requestId === undefined || item.requestId === requestId,
          )
          .sort((a, b) => b.requestedAt - a.requestedAt || b.id - a.id)
        const items = entries
          .slice(offset, offset + limit)
          .map(({ snapshotFile, ...metadata }) => ({
            ...metadata,
            hasResponse: Boolean(snapshotFile),
          }))
        const hasMore = offset + items.length < entries.length
        return {
          items,
          hasMore,
          nextOffset: hasMore ? offset + items.length : null,
        }
      }, 'History list exceeds the 2 MiB limit. Reduce limit and retry.'),
  )

  server.registerTool(
    'get_http_history',
    {
      description:
        'Read an existing saved redacted HTTP history snapshot by history ID. Does not send a request or resolve current secrets. Returns HISTORY_SNAPSHOT_UNAVAILABLE for missing, expired or unavailable snapshots. Result JSON is capped at 2 MiB; larger snapshots must be inspected in massCode.',
      inputSchema: { id: idSchema },
      annotations: readOnly,
    },
    ({ id }) => {
      return safely(() => {
        const snapshot = useHttpStorage().history.getSnapshot(id)
        if (!snapshot)
          throw new Error('HISTORY_SNAPSHOT_UNAVAILABLE')
        return { id, ...snapshot }
      })
    },
  )
}
