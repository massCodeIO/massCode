import type { HttpFolderTreeItem } from '@/composables/spaces/http/useHttpFolderTree'
import type { HttpRequestsResponse } from '@/services/api/generated'
import { describe, expect, it } from 'vitest'
import { buildNavigationNodes, sidebarNodes, UNFILED_ID } from '../liveModel'

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
        createdAt: 1,
        updatedAt: 1,
        isOpen: 1,
        orderIndex: 0,
        children: [
          {
            id: 2,
            parentId: 1,
            name: 'Accounts',
            icon: null,
            children: [],
            createdAt: 1,
            updatedAt: 1,
            isOpen: 1,
            orderIndex: 0,
          },
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

describe('sidebar sections', () => {
  const nodes: import('../types').HttpTreeNode[] = [
    { id: 'collection', name: 'API', parentId: null, kind: 'collection' },
    { id: 'folder', name: 'Accounts', parentId: 'collection', kind: 'folder' },
    {
      id: 'starred',
      name: 'List accounts',
      parentId: 'folder',
      kind: 'request',
      favorite: true,
    },
    {
      id: 'ordinary',
      name: 'Update accounts',
      parentId: 'folder',
      kind: 'request',
    },
    { id: 'loose', name: 'Quick request', parentId: null, kind: 'request' },
    {
      id: 'deleted',
      name: 'Old request',
      parentId: 'folder',
      kind: 'request',
      deleted: true,
    },
  ]
  it('groups unfiled requests without modifying their stored parents', () => {
    const result = sidebarNodes(nodes, {
      trash: false,
      favorites: false,
      unfiledLabel: 'Inbox',
    })
    expect(result.find(node => node.id === 'loose')?.parentId).toBe(
      UNFILED_ID,
    )
    expect(nodes.find(node => node.id === 'loose')?.parentId).toBeNull()
    expect(result.some(node => node.deleted)).toBe(false)
    expect(
      sidebarNodes(
        nodes.filter(node => node.id !== 'loose'),
        { trash: false, favorites: false, unfiledLabel: 'Inbox' },
      ).some(node => node.id === UNFILED_ID),
    ).toBe(false)
  })
  it('keeps the ancestor hierarchy when showing favorites', () => {
    expect(
      sidebarNodes(nodes, {
        trash: false,
        favorites: true,
        unfiledLabel: 'Inbox',
      }).map(node => node.id),
    ).toEqual(['collection', 'folder', 'starred'])
  })
  it('keeps deleted requests exclusively in the trash section', () => {
    expect(
      sidebarNodes(nodes, {
        trash: true,
        favorites: false,
        unfiledLabel: 'Inbox',
      }),
    ).toEqual([{ ...nodes[5], parentId: null }])
  })
})
