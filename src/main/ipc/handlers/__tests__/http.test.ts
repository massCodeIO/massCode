import { describe, expect, it, vi } from 'vitest'
import { formatHttpRequestError } from '../http'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock('../../../storage', () => ({
  useHttpStorage: vi.fn(),
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
