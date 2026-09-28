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
      deleted: Boolean(request.isDeleted),
      favorite: Boolean(request.isFavorites),
    }),
  )
  return result
}

export const UNFILED_ID = 'unfiled'

export function sidebarNodes(
  nodes: HttpTreeNode[],
  options: { trash: boolean, favorites: boolean, unfiledLabel: string },
): HttpTreeNode[] {
  if (options.trash) {
    return nodes
      .filter(node => node.deleted)
      .map(node => ({ ...node, parentId: null }))
  }
  const active = nodes.filter(node => !node.deleted)
  const unfiled = active.some(
    node => node.kind === 'request' && node.parentId === null,
  )
  const result: HttpTreeNode[] = unfiled
    ? [
        {
          id: UNFILED_ID,
          name: options.unfiledLabel,
          kind: 'folder',
          parentId: null,
        },
        ...active.map(node =>
          node.kind === 'request' && node.parentId === null
            ? { ...node, parentId: UNFILED_ID }
            : node,
        ),
      ]
    : active
  if (!options.favorites)
    return result
  const included = new Set<string>()
  const byId = new Map(result.map(node => [node.id, node]))
  for (const node of result.filter(node => node.favorite)) {
    let current: HttpTreeNode | undefined = node
    while (current && !included.has(current.id)) {
      included.add(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }
  return result.filter(node => included.has(node.id))
}
