import { Elysia } from 'elysia'
import { expect, it, vi } from 'vitest'
import routes from '../http-history'

vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    history: {
      getEntries: () => [
        {
          id: 1,
          requestId: 1,
          method: 'GET',
          url: 'https://example.test',
          status: 200,
          durationMs: 1,
          sizeBytes: 1,
          requestedAt: 1,
          snapshotFile: 'abc.json',
        },
        {
          id: 2,
          requestId: 1,
          method: 'GET',
          url: 'https://example.test',
          status: null,
          durationMs: 1,
          sizeBytes: 0,
          requestedAt: 2,
          snapshotFile: 'def.json',
        },
        {
          id: 3,
          requestId: 1,
          method: 'GET',
          url: 'https://example.test',
          status: 200,
          durationMs: 1,
          sizeBytes: 1,
          requestedAt: 3,
        },
      ],
    },
  }),
}))

it('marks only persisted response snapshots for the dashboard', async () => {
  const app = new Elysia().use(routes)
  const response = await app.handle(
    new Request('http://localhost/http-history/'),
  )
  expect(response.status).toBe(200)
  const entries = await response.json()
  expect(
    entries.map((entry: { hasResponse: boolean }) => entry.hasResponse),
  ).toEqual([true, false, false])
})
