import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiApp } from '../app'

const context = vi.hoisted(() => ({
  getVaultPath: vi.fn(() => '/test-vault'),
  isIntegrationTokenAuthorized: vi.fn(
    (authorization?: string) => authorization === 'Bearer integration-token',
  ),
}))

vi.mock('../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: context.getVaultPath,
}))

vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: vi.fn(() => false),
      set: vi.fn(),
    },
  },
}))

vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: context.isIntegrationTokenAuthorized,
}))

const port = 4321
const sessionToken = 'mc_session_test-token'

function request(
  pathname: string,
  options: RequestInit = {},
  host = `localhost:${port}`,
): Request {
  const headers = new Headers(options.headers)
  headers.set('host', host)

  return new Request(`http://localhost:${port}${pathname}`, {
    ...options,
    headers,
  })
}

describe('local API security policy', () => {
  beforeEach(() => {
    context.getVaultPath.mockClear()
    context.isIntegrationTokenAuthorized.mockClear()
  })

  it.each([`localhost:${port}`, `127.0.0.1:${port}`, `LOCALHOST:${port}`])(
    'allows the expected Host %s',
    async (host) => {
      const app = createApiApp({ port, sessionToken, version: 'test' })
      const response = await app.handle(
        request(
          '/system/storage-vault-path',
          {
            headers: { authorization: `Bearer ${sessionToken}` },
          },
          host,
        ),
      )

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ vaultPath: '/test-vault' })
    },
  )

  it.each(['evil.example:4321', 'localhost:9999', '127.0.0.1'])(
    'rejects unexpected Host %s',
    async (host) => {
      const app = createApiApp({ port, sessionToken, version: 'test' })
      const response = await app.handle(
        request(
          '/system/storage-vault-path',
          {
            headers: { authorization: `Bearer ${sessionToken}` },
          },
          host,
        ),
      )

      expect(response.status).toBe(403)
      expect(context.getVaultPath).not.toHaveBeenCalled()
    },
  )

  it('rejects a missing Host header', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })
    const response = await app.handle(
      new Request(`http://localhost:${port}/system/storage-vault-path`, {
        headers: { authorization: `Bearer ${sessionToken}` },
      }),
    )

    expect(response.status).toBe(403)
    expect(context.getVaultPath).not.toHaveBeenCalled()
  })

  it.each([undefined, 'Bearer invalid'])(
    'rejects protected routes with authorization %s',
    async (authorization) => {
      const app = createApiApp({ port, sessionToken, version: 'test' })
      const response = await app.handle(
        request('/system/storage-vault-path', {
          headers: authorization ? { authorization } : undefined,
        }),
      )

      expect(response.status).toBe(401)
      expect(context.getVaultPath).not.toHaveBeenCalled()
    },
  )

  it('rejects an Integration API token on internal routes', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })
    const response = await app.handle(
      request('/system/storage-vault-path', {
        headers: { authorization: 'Bearer integration-token' },
      }),
    )

    expect(response.status).toBe(401)
    expect(context.getVaultPath).not.toHaveBeenCalled()
  })

  it('leaves Swagger GET and HEAD public but not non-read methods', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })

    const getResponse = await app.handle(request('/swagger/json'))
    const headResponse = await app.handle(
      request('/swagger/json', { method: 'HEAD' }),
    )
    const postResponse = await app.handle(
      request('/swagger/json', { method: 'POST' }),
    )

    expect(getResponse.status).toBe(200)
    expect(headResponse.status).toBe(200)
    expect(postResponse.status).toBe(404)
  })

  it.each(['/captures', '/captures/'])(
    'allows capture preflight only on the exact path %s',
    async (pathname) => {
      const app = createApiApp({ port, sessionToken, version: 'test' })
      const response = await app.handle(
        request(pathname, {
          headers: {
            'access-control-request-headers': 'authorization, content-type',
            'access-control-request-method': 'POST',
            'origin': 'chrome-extension://example',
          },
          method: 'OPTIONS',
        }),
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'POST, OPTIONS',
      )
    },
  )

  it('does not expose capture CORS or auth exemptions to other paths or methods', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })
    const otherPath = await app.handle(
      request('/captures/extra', { method: 'OPTIONS' }),
    )
    const getCapture = await app.handle(
      request('/captures/', { method: 'GET' }),
    )

    expect(otherPath.status).toBe(404)
    expect(otherPath.headers.has('access-control-allow-origin')).toBe(false)
    expect(getCapture.status).toBe(404)
    expect(getCapture.headers.has('access-control-allow-origin')).toBe(false)
  })

  it('keeps capture POST behind the integration token check', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })
    const response = await app.handle(
      request('/captures/', {
        body: JSON.stringify({ target: 'notes', text: 'test' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('does not accept the internal session token for captures', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })
    const response = await app.handle(
      request('/captures/', {
        body: JSON.stringify({ target: 'notes', text: 'test' }),
        headers: {
          'authorization': `Bearer ${sessionToken}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
    expect(context.isIntegrationTokenAuthorized).toHaveBeenCalledWith(
      `Bearer ${sessionToken}`,
    )
  })

  it('passes an authorized capture to capture validation', async () => {
    const app = createApiApp({ port, sessionToken, version: 'test' })
    const response = await app.handle(
      request('/captures/', {
        body: JSON.stringify({ target: 'code' }),
        headers: {
          'authorization': 'Bearer integration-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      message: 'Code capture requires selected text',
    })
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})
