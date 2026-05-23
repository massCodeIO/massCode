import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { formatHttpRequestError, registerHttpHandlers } from '../http'

const { AgentMock, handleMock, requestMock } = vi.hoisted(() => ({
  AgentMock: class {
    options: unknown

    constructor(options: unknown) {
      this.options = options
    }
  },
  handleMock: vi.fn(),
  requestMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
}))

vi.mock('undici', () => ({
  Agent: vi.fn(AgentMock),
  request: requestMock,
}))

vi.mock('../../../storage', () => ({
  useHttpStorage: () => ({
    environments: {
      getEnvironments: () => [],
    },
    history: {
      appendEntry: vi.fn(),
    },
  }),
}))

describe('formatHttpRequestError', () => {
  it('uses connection failure details from nested undici causes', () => {
    const error = new Error('fetch failed') as Error & {
      cause: NodeJS.ErrnoException
    }
    error.cause = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:3030'),
      {
        address: '127.0.0.1',
        code: 'ECONNREFUSED',
        port: 3030,
        syscall: 'connect',
      },
    )

    expect(formatHttpRequestError(error)).toBe(
      'connect ECONNREFUSED 127.0.0.1:3030',
    )
  })

  it('unwraps aggregate connection failures from localhost attempts', () => {
    const error = new Error('fetch failed') as Error & {
      cause: AggregateError
    }
    error.cause = new AggregateError(
      [
        Object.assign(new Error('connect ECONNREFUSED ::1:3030'), {
          address: '::1',
          code: 'ECONNREFUSED',
          port: 3030,
          syscall: 'connect',
        }),
        Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3030'), {
          address: '127.0.0.1',
          code: 'ECONNREFUSED',
          port: 3030,
          syscall: 'connect',
        }),
      ],
      'AggregateError',
    )

    expect(formatHttpRequestError(error)).toBe(
      'connect ECONNREFUSED 127.0.0.1:3030',
    )
  })

  it('falls back to the nested cause message when endpoint parts are missing', () => {
    const error = new Error('fetch failed') as Error & { cause: Error }
    error.cause = new Error('getaddrinfo ENOTFOUND api.local')

    expect(formatHttpRequestError(error)).toBe(
      'getaddrinfo ENOTFOUND api.local',
    )
  })
})

describe('registerHttpHandlers', () => {
  it('uses an insecure dispatcher when certificate verification is skipped', async () => {
    requestMock.mockResolvedValueOnce({
      body: Readable.from([]),
      headers: {},
      statusCode: 200,
    })

    registerHttpHandlers()
    const handler = handleMock.mock.calls.find(
      ([channel]) => channel === 'spaces:http:execute',
    )?.[1]

    await handler(null, {
      environmentId: null,
      request: {
        auth: { type: 'none' },
        body: null,
        bodyType: 'none',
        formData: [],
        headers: [],
        method: 'GET',
        query: [],
        url: 'https://example.test',
      },
      requestId: null,
      skipCertificateVerification: true,
    })

    expect(requestMock).toHaveBeenCalledWith(
      'https://example.test/',
      expect.objectContaining({
        dispatcher: expect.objectContaining({
          options: {
            connect: {
              rejectUnauthorized: false,
            },
          },
        }),
      }),
    )
  })
})
