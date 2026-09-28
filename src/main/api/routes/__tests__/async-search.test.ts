import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import notes from '../notes'
import snippets from '../snippets'

const context = vi.hoisted(() => ({
  sync: vi.fn(() => []),
  async: vi.fn(async () => []),
  available: true,
}))
vi.mock('../../../storage', () => ({
  useStorage: () => ({
    snippets: {
      getSnippets: context.sync,
      getSnippetsAsync: context.available ? context.async : undefined,
    },
  }),
  useNotesStorage: () => ({
    notes: {
      getNotes: context.sync,
      getNotesAsync: context.available ? context.async : undefined,
    },
  }),
}))
vi.mock('../../../tasks', () => ({ runTasksCleanupNow: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  context.available = true
})
describe.each([
  ['snippets', snippets],
  ['notes', notes],
] as const)('%s search routing', (domain, routes) => {
  it('awaits asynchronous full-text search', async () => {
    const app = new Elysia().use(routes)
    const response = await app.handle(
      new Request(`http://localhost/${domain}/?search=body`),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
    expect(context.async).toHaveBeenCalledOnce()
    expect(context.sync).not.toHaveBeenCalled()
  })
  it.each(['', '?search=name&searchNameOnly=1'])(
    'keeps synchronous list/name-only search for %s',
    async (query) => {
      const response = await new Elysia()
        .use(routes)
        .handle(new Request(`http://localhost/${domain}/${query}`))
      expect(response.status).toBe(200)
      expect(context.sync).toHaveBeenCalledOnce()
      expect(context.async).not.toHaveBeenCalled()
    },
  )
  it('falls back for a provider without asynchronous search', async () => {
    context.available = false
    const response = await new Elysia()
      .use(routes)
      .handle(new Request(`http://localhost/${domain}/?search=body`))
    expect(response.status).toBe(200)
    expect(context.sync).toHaveBeenCalledOnce()
  })
})
