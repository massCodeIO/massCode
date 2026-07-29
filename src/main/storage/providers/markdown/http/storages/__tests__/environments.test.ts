import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getHttpPaths } from '../../runtime/paths'
import { ensureHttpStateFile } from '../../runtime/state'
import { resetHttpRuntimeCache } from '../../runtime/sync'
import { createHttpEnvironmentsStorage } from '../environments'

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

      return this.state[key]
    }

    set(key: string, value: unknown): void {
      this.state[key] = value
    }
  }

  return { default: MockStore }
})

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}))

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
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

describe('http environments storage secrets', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'http-environments-storage-'),
    )
    resetHttpRuntimeCache()
    ensureHttpStateFile(getHttpPaths(tempVaultPath))
  })

  afterEach(() => {
    resetHttpRuntimeCache()
    fs.removeSync(tempVaultPath)
    tempVaultPath = ''
    vi.clearAllMocks()
  })

  it('drops the plain value from the vault when a variable becomes secret', () => {
    const environments = createHttpEnvironmentsStorage()
    const { id } = environments.createEnvironment({
      name: 'Local',
      variables: { API_KEY: 'plain-token', BASE_URL: 'http://localhost' },
    })

    expect(environments.addSecretKey(id, 'API_KEY')).toEqual({
      notFound: false,
    })

    const env = environments.getEnvironments().find(item => item.id === id)!
    expect(env.secretKeys).toEqual(['API_KEY'])
    expect(env.variables).toEqual({ BASE_URL: 'http://localhost' })
  })

  it('ignores a secret value sent through plain variables', () => {
    const environments = createHttpEnvironmentsStorage()
    const { id } = environments.createEnvironment({ name: 'Local' })
    environments.addSecretKey(id, 'API_KEY')

    expect(
      environments.updateEnvironment(id, {
        variables: { API_KEY: 'leaked-token', BASE_URL: 'http://localhost' },
      }),
    ).toEqual({ invalidInput: false, notFound: false })

    const env = environments.getEnvironments().find(item => item.id === id)!
    expect(env.variables).toEqual({ BASE_URL: 'http://localhost' })
    expect(env.secretKeys).toEqual(['API_KEY'])
  })

  it('removes the key from secretKeys when protection is dropped', () => {
    const environments = createHttpEnvironmentsStorage()
    const { id } = environments.createEnvironment({ name: 'Local' })
    environments.addSecretKey(id, 'API_KEY')

    expect(environments.removeSecretKey(id, 'API_KEY')).toEqual({
      notFound: false,
    })

    const env = environments.getEnvironments().find(item => item.id === id)!
    expect(env.secretKeys).toBeUndefined()
    expect(env.variables).toEqual({})
  })

  it('reports notFound for an unknown environment', () => {
    const environments = createHttpEnvironmentsStorage()

    expect(environments.addSecretKey(404, 'API_KEY')).toEqual({
      notFound: true,
    })
    expect(environments.removeSecretKey(404, 'API_KEY')).toEqual({
      notFound: true,
    })
  })
})
