import { beforeEach, describe, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({
    status: 200,
    statusText: 'OK',
    headers: [['content-type', 'application/json']],
    body: new TextEncoder().encode('{}').buffer,
  })),
}))

vi.mock('@/electron', () => ({
  i18n: { t: vi.fn() },
  ipc: { invoke: context.invoke },
  store: {
    preferences: {
      get: vi.fn(() => 4321),
    },
  },
}))

vi.mock('@/composables/useSonner', () => ({
  useSonner: vi.fn(),
}))

describe('renderer API transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses scoped IPC without fetching or exposing a bearer in renderer', async () => {
    const fetch = vi.fn<(request: Request) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    )
    vi.stubGlobal('fetch', fetch)
    const { api } = await import('../index')

    expect(context.invoke).not.toHaveBeenCalled()

    await api.system.getSystemStorageVaultPath()
    await api.system.getSystemStorageVaultPath()

    expect(context.invoke).toHaveBeenCalledTimes(2)
    expect(context.invoke).toHaveBeenCalledWith(
      'system:api-request',
      expect.objectContaining({
        url: 'http://127.0.0.1:4321/system/storage-vault-path',
        method: 'GET',
        body: undefined,
      }),
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(JSON.stringify(context.invoke.mock.calls)).not.toContain('Bearer')
    vi.unstubAllGlobals()
  })
})
