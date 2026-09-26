import { Buffer } from 'node:buffer'
import { emptyHttpRuntime } from '../../../shared/httpRuntime'
import { useHttpStorage } from '../../storage'
import { CONTENT_LIMIT } from './results'

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

export function getHttpItem(id: number, checkContentSize = true) {
  const item = useHttpStorage().requests.getRequestById(id)
  if (!item || item.isDeleted || item.protocol === 'websocket')
    throw new Error('HTTP_REQUEST_NOT_FOUND')
  if (item.pendingCloudDownload)
    throw new Error('CLOUD_FILE_NOT_DOWNLOADED')
  if (
    checkContentSize
    && Buffer.byteLength(item.body ?? '', 'utf8')
    + Buffer.byteLength(item.description, 'utf8')
    > CONTENT_LIMIT
  ) {
    throw new Error('CONTENT_TOO_LARGE')
  }
  return { type: 'http_request' as const, ...item }
}

export function mcpHttpRuntime(
  runtime: ReturnType<typeof getHttpItem>['runtime'],
) {
  const saved = runtime ?? emptyHttpRuntime()
  return {
    ...saved,
    transport: {
      ...saved.transport,
      maxResponseBytes: Math.min(
        saved.transport?.maxResponseBytes || CONTENT_LIMIT,
        CONTENT_LIMIT,
      ),
      timeoutMs: Math.min(saved.transport?.timeoutMs || 30_000, 60_000),
    },
  }
}
