import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import snippets from '../snippets'

const context = vi.hoisted(() => ({ reorder: vi.fn(), update: vi.fn() }))
vi.mock('../../../storage', () => ({
  useStorage: () => ({
    snippets: {
      reorderSnippetContents: context.reorder,
      updateSnippetContent: context.update,
    },
  }),
}))

function reorder(contentIds: unknown) {
  return new Elysia().use(snippets).handle(
    new Request('http://localhost/snippets/1/contents/order', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contentIds }),
    }),
  )
}

beforeEach(() => vi.resetAllMocks())
describe('snippet fragment order route', () => {
  it('routes order to its static endpoint instead of contentId', async () => {
    const response = await reorder([2, 1])
    expect(response.status).toBe(200)
    expect(context.reorder).toHaveBeenCalledWith(1, [2, 1])
    expect(context.update).not.toHaveBeenCalled()
  })
  it.each([
    ['INVALID_CONTENT_ORDER', 400],
    ['SNIPPET_NOT_FOUND', 404],
    ['CLOUD_FILE_NOT_DOWNLOADED', 503],
    ['VAULT_HYDRATING', 503],
  ])('maps %s to %s', async (code, status) => {
    context.reorder.mockImplementation(() => {
      throw new Error(`${code}: unavailable`)
    })
    expect((await reorder([2, 1])).status).toBe(status)
  })
  it.each([[0], [-1], [1.5]])('rejects invalid ID %s', async (ids) => {
    expect((await reorder(ids)).status).toBe(400)
    expect(context.reorder).not.toHaveBeenCalled()
  })
})
