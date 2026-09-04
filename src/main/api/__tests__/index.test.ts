import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initApi } from '../index'

const context = vi.hoisted(() => ({
  createApiApp: vi.fn(),
  listen: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '5.10.0') },
}))

vi.mock('elysia', () => ({
  Elysia: class Elysia {
    constructor(public options: unknown) {}
  },
}))

vi.mock('../../store', () => ({
  store: {
    preferences: { get: vi.fn(() => 4321) },
  },
}))

vi.mock('../../utils', () => ({
  importEsm: vi.fn(async () => ({ node: () => 'node-adapter' })),
}))

vi.mock('../app', () => ({
  createApiApp: context.createApiApp,
}))

describe('api network initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    context.createApiApp.mockReturnValue({ listen: context.listen })
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('binds the Node adapter explicitly to IPv4 loopback', async () => {
    await initApi('session-token')

    expect(context.createApiApp).toHaveBeenCalledWith(
      {
        port: 4321,
        sessionToken: 'session-token',
        version: '5.10.0',
      },
      expect.objectContaining({ options: { adapter: 'node-adapter' } }),
    )
    expect(context.listen).toHaveBeenCalledWith({
      hostname: '127.0.0.1',
      port: 4321,
    })
  })
})
