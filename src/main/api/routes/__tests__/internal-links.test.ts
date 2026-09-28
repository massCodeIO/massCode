import { Elysia } from 'elysia'
import { expect, it, vi } from 'vitest'
import routes from '../internal-links'

vi.mock('../../../storage', () => ({
  useStorage: () => ({
    snippets: {
      getSnippets: () => [{ id: 10, name: 'Renamed snippet' }],
      getSnippetById: () => ({
        id: 10,
        name: 'Renamed snippet',
        folder: null,
        isDeleted: 0,
        contents: [],
      }),
    },
  }),
  useNotesStorage: () => ({
    notes: {
      getNotes: () => [{ id: 20, name: 'Renamed note', folder: null }],
      getNoteById: () => ({
        id: 20,
        name: 'Renamed note',
        folder: null,
        isDeleted: 0,
        content: '',
      }),
    },
    folders: { getFolders: () => [] },
  }),
  useHttpStorage: () => ({
    requests: {
      getRequests: () => [{ id: 30, name: 'Renamed request', folderId: null }],
      getRequestById: () => ({
        id: 30,
        name: 'Renamed request',
        isDeleted: 0,
        method: 'GET',
        url: '',
        description: '',
      }),
    },
    folders: { getFolders: () => [] },
  }),
}))

it('resolves ID links across all spaces after renaming and preserves title lookup', async () => {
  const app = new Elysia().use(routes)
  const response = await app.handle(
    new Request('http://localhost/internal-links/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titles: [
          'snippet:10',
          'note:20',
          'http-request:30',
          'Renamed note',
          'note:999',
        ],
      }),
    }),
  )
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(
    result.map(
      (item: { resolved: { name: string } | null }) =>
        item.resolved?.name ?? null,
    ),
  ).toEqual([
    'Renamed snippet',
    'Renamed note',
    'Renamed request',
    'Renamed note',
    null,
  ])
})
