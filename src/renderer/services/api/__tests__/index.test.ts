import { beforeEach, describe, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => ({
  invoke: vi.fn(async () => 'mc_session_renderer-token'),
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

describe('renderer API authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lazily reuses the IPC session token for API requests', async () => {
    const fetch = vi.fn<(request: Request) => Promise<Response>>(
      async () => new Response(null, { status: 200 }),
    )
    vi.stubGlobal('fetch', fetch)
    const { api } = await import('../index')

    expect(context.invoke).not.toHaveBeenCalled()

    await api.system.getSystemStorageVaultPath()
    await api.system.getSystemStorageVaultPath()

    expect(context.invoke).toHaveBeenCalledTimes(1)
    expect(context.invoke).toHaveBeenCalledWith(
      'system:api-session-token',
      undefined,
    )
    expect(fetch).toHaveBeenCalledTimes(2)

    for (const [request] of fetch.mock.calls) {
      expect(request.url).toBe(
        'http://127.0.0.1:4321/system/storage-vault-path',
      )
      expect(request.headers.get('authorization')).toBe(
        'Bearer mc_session_renderer-token',
      )
    }
  })
})
