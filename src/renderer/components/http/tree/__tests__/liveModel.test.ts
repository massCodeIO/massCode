import type { HttpFolderTreeItem } from '@/composables/spaces/http/useHttpFolderTree'
import type { HttpRequestsResponse } from '@/services/api/generated'
import { describe, expect, it } from 'vitest'
import { buildNavigationNodes } from '../liveModel'

// Metadata adapter must preserve identities even when folders and requests
// happen to have the same numeric ID.
describe('hTTP navigation metadata', () => {
  it('separates collection, nested folder and request identities without changing parents', () => {
    const folders = [
      {
        id: 1,
        parentId: null,
        name: 'API',
        icon: null,
        children: [
          { id: 2, parentId: 1, name: 'Accounts', icon: null, children: [] },
        ],
      },
    ] as HttpFolderTreeItem[]
    const requests = [
      {
        id: 1,
        folderId: 2,
        name: 'List',
        method: 'GET',
        protocol: 'http',
        url: '/accounts',
        pendingCloudDownload: true,
        isFavorites: 1,
      },
      {
        id: 2,
        folderId: null,
        name: 'Inbox',
        method: 'POST',
        protocol: 'http',
        url: '/inbox',
      },
    ] as HttpRequestsResponse
    const nodes = buildNavigationNodes(folders, requests)
    expect(
      nodes.map(({ id, parentId, kind }) => ({ id, parentId, kind })),
    ).toEqual([
      { id: 'folder:1', parentId: null, kind: 'collection' },
      { id: 'folder:2', parentId: 'folder:1', kind: 'folder' },
      { id: 'request:1', parentId: 'folder:2', kind: 'request' },
      { id: 'request:2', parentId: null, kind: 'request' },
    ])
    expect(nodes[2]).toMatchObject({
      pending: true,
      favorite: true,
      entityId: 1,
    })
    expect(requests[0].folderId).toBe(2)
  })
})
