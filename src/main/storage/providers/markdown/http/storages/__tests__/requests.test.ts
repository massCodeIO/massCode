import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getHttpPaths } from '../../runtime/paths'
import { ensureHttpStateFile } from '../../runtime/state'
import { resetHttpRuntimeCache } from '../../runtime/sync'
import { createHttpRequestsStorage } from '../requests'

let tempVaultPath = ''

vi.mock('electron-store', () => {
  class MockStore {
    private state: Record<string, unknown>

    constructor(options?: { defaults?: Record<string, unknown> }) {
      this.state = { ...(options?.defaults || {}) }
    }

    get(key?: string): unknown {
      if (!key) {
        return this.state
      }

      return key.split('.').reduce<unknown>((acc, segment) => {
        if (!acc || typeof acc !== 'object') {
          return undefined
        }

        return (acc as Record<string, unknown>)[segment]
      }, this.state)
    }

    set(key: string, value: unknown): void {
      const segments = key.split('.')
      let cursor: Record<string, unknown> = this.state

      for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index]
        const next = cursor[segment]

        if (!next || typeof next !== 'object') {
          cursor[segment] = {}
        }

        cursor = cursor[segment] as Record<string, unknown>
      }

      cursor[segments[segments.length - 1]] = value
    }
  }

  return { default: MockStore }
})

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../../../../../../store', () => ({
  store: {
    preferences: {
      get: (key: string) => {
        if (key === 'storage.vaultPath') {
          return tempVaultPath
        }

        return undefined
      },
    },
  },
}))

describe('http requests storage', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'http-requests-storage-'),
    )
    resetHttpRuntimeCache()
    ensureHttpStateFile(getHttpPaths(tempVaultPath))
  })

  afterEach(() => {
    resetHttpRuntimeCache()
    fs.removeSync(tempVaultPath)
    tempVaultPath = ''
    vi.useRealTimers()
  })

  it('sorts requests by name and updated date', () => {
    vi.useFakeTimers()

    const storage = createHttpRequestsStorage()

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const bravo = storage.createRequest({ name: 'Bravo' })

    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
    const alpha = storage.createRequest({ name: 'Alpha' })

    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'))
    storage.updateRequest(bravo.id, { description: 'Updated' })

    expect(
      storage
        .getRequests({ sort: 'name', order: 'ASC' })
        .map(request => request.id),
    ).toEqual([alpha.id, bravo.id])
    expect(
      storage
        .getRequests({ sort: 'updatedAt', order: 'DESC' })
        .map(request => request.id),
    ).toEqual([bravo.id, alpha.id])
  })

  it('keeps URL search and searchNameOnly behavior while sorting', () => {
    const storage = createHttpRequestsStorage()

    const urlMatch = storage.createRequest({
      name: 'Bravo',
      url: 'https://example.com/target',
    })
    storage.createRequest({
      name: 'Alpha',
      url: 'https://example.com/other',
    })
    const nameMatch = storage.createRequest({
      name: 'Target Request',
      url: 'https://example.com/other-target',
    })

    expect(
      storage
        .getRequests({ search: 'target', sort: 'name', order: 'ASC' })
        .map(request => request.id),
    ).toEqual([urlMatch.id, nameMatch.id])
    expect(
      storage
        .getRequests({
          search: 'target',
          searchNameOnly: 1,
          sort: 'name',
          order: 'ASC',
        })
        .map(request => request.id),
    ).toEqual([nameMatch.id])
  })
})
