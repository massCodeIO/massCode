import type { MarkdownRuntimeCache } from '../types'
import os from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runtimeRef } from '../cache'
import { flushPendingStateWritesOrThrow } from '../shared/stateWriter'
import { resetRuntimeCache } from '../sync'

const reconciler = vi.hoisted(() => ({
  abandon: vi.fn(),
  begin: vi.fn(),
  isReconciled: vi.fn(() => true),
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}))

vi.mock('../../../../../store', () => ({
  store: {
    preferences: {
      get: () => undefined,
    },
  },
}))

vi.mock('../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

vi.mock('../shared/stateWriter', () => ({
  flushPendingStateWritesOrThrow: vi.fn(),
}))

vi.mock('../shared/vaultReconcile', () => ({
  createVaultReconciler: () => reconciler,
}))

function createRuntimeCache(): MarkdownRuntimeCache {
  return {
    paths: {
      vaultPath: '/vault/code',
    },
  } as MarkdownRuntimeCache
}

beforeEach(() => {
  vi.clearAllMocks()
  runtimeRef.cache = createRuntimeCache()
})

describe('resetRuntimeCache lifecycle', () => {
  it('preserves runtime and reconciler state when pending writes remain', () => {
    const cache = runtimeRef.cache
    vi.mocked(flushPendingStateWritesOrThrow).mockImplementationOnce(() => {
      throw new Error('Pending state writes remain')
    })

    expect(() => resetRuntimeCache()).toThrow('Pending state writes remain')
    expect(runtimeRef.cache).toBe(cache)
    expect(reconciler.abandon).not.toHaveBeenCalled()
  })

  it('abandons reconciliation and clears runtime after a successful flush', () => {
    resetRuntimeCache()

    expect(flushPendingStateWritesOrThrow).toHaveBeenCalledTimes(1)
    expect(reconciler.abandon).toHaveBeenCalledWith('/vault/code')
    expect(runtimeRef.cache).toBeNull()
  })
})
