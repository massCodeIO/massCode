import type { HttpFolderTreeItem } from '@/composables/spaces/http/useHttpFolderTree'
import type { HttpRequestsResponse } from '@/services/api/generated'
import type { HttpTreeNode } from './types'

export function folderKey(id: number) {
  return `folder:${id}`
}
export function requestKey(id: number) {
  return `request:${id}`
}

export function buildNavigationNodes(
  folders: HttpFolderTreeItem[],
  requests: HttpRequestsResponse,
): HttpTreeNode[] {
  const result: HttpTreeNode[] = []
  function walk(items: HttpFolderTreeItem[]) {
    for (const folder of items) {
      result.push({
        id: folderKey(folder.id),
        entityId: folder.id,
        parentId: folder.parentId === null ? null : folderKey(folder.parentId),
        kind: folder.parentId === null ? 'collection' : 'folder',
        name: folder.name,
        icon: folder.icon,
      })
      walk(folder.children)
    }
  }
  walk(folders)
  requests.forEach(request =>
    result.push({
      id: requestKey(request.id),
      entityId: request.id,
      parentId: request.folderId === null ? null : folderKey(request.folderId),
      kind: 'request',
      name: request.name,
      method: request.method,
      protocol: request.protocol,
      url: request.url,
      pending: request.pendingCloudDownload,
      favorite: Boolean(request.isFavorites),
    }),
  )
  return result
}
