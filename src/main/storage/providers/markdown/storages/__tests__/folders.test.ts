import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enqueueCloudDownload } from '../../cloudDownloads'
import { getPaths } from '../../runtime/paths'
import {
  getFileAvailability,
  markAppWrittenFileAsLocal,
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../../runtime/shared/cloudFiles'
import { ensureStateFile } from '../../runtime/state'
import { resetRuntimeCache } from '../../runtime/sync'
import { createFoldersStorage } from '../folders'

let tempVaultPath = ''

function makeSparsePlaceholder(absolutePath: string, size = 4096): void {
  fs.removeSync(absolutePath)
  const fd = fs.openSync(absolutePath, 'w')
  fs.ftruncateSync(fd, size)
  fs.closeSync(fd)
}

function mockFolderMetadataAsZeroBlocks() {
  const statSync = fs.statSync.bind(fs)

  return vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
    const stats = statSync(filePath)

    if (
      typeof filePath === 'string'
      && filePath.endsWith('.meta.yaml')
      && stats.size > 0
    ) {
      return Object.assign(stats, { blocks: 0 })
    }

    return stats
  })
}

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

vi.mock('../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

vi.mock('../../../../../store', () => ({
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

describe('code folders storage validations', () => {
  beforeEach(() => {
    tempVaultPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'code-folders-storage-'),
    )
    resetRuntimeCache()
    ensureStateFile(getPaths(tempVaultPath))
  })

  afterEach(() => {
    setDatalessProbeForTests(null)
    resetCloudFileExemptions()
    resetRuntimeCache()

    if (tempVaultPath) {
      fs.removeSync(tempVaultPath)
    }
  })

  it('updateFolder with empty patch returns invalidInput', () => {
    const storage = createFoldersStorage()
    const { id } = storage.createFolder({ name: 'Test Folder' })
    const result = storage.updateFolder(id, {})

    expect(result).toEqual({ invalidInput: true, notFound: false })
  })

  it('moving folder into sibling level with same name auto-resolves unique name', () => {
    const storage = createFoldersStorage()
    const { id: parentId } = storage.createFolder({ name: 'Parent' })

    storage.createFolder({ name: 'Dupe', parentId })
    const { id: rootDupeId } = storage.createFolder({ name: 'Dupe' })

    const result = storage.updateFolder(rootDupeId, { parentId })

    expect(result).toEqual({ invalidInput: false, notFound: false })

    const movedFolder = storage
      .getFolders()
      .find(folder => folder.id === rootDupeId)
    expect(movedFolder?.parentId).toBe(parentId)
    expect(movedFolder?.name).toBe('Dupe 1')
  })

  it('rename to existing disk directory throws NAME_CONFLICT', () => {
    const storage = createFoldersStorage()
    const { id } = storage.createFolder({ name: 'Source' })
    const codeRootPath = getPaths(tempVaultPath).vaultPath

    fs.ensureDirSync(path.join(codeRootPath, 'Target'))

    expect(() => storage.updateFolder(id, { name: 'Target' })).toThrow(
      'NAME_CONFLICT',
    )
  })

  it('rejects reserved flat space names at root level', () => {
    const storage = createFoldersStorage()

    expect(() => storage.createFolder({ name: 'math' })).toThrow(
      'RESERVED_NAME',
    )
  })

  it('keeps resident zero-block subtree metadata local after parent rename', () => {
    const paths = getPaths(tempVaultPath)
    setDatalessProbeForTests(() => true)
    const statSpy = mockFolderMetadataAsZeroBlocks()

    try {
      const storage = createFoldersStorage()
      const parent = storage.createFolder({ name: 'Before' })
      storage.createFolder({ name: 'Child', parentId: parent.id })

      storage.updateFolder(parent.id, { name: 'After' })

      const parentMetaPath = path.join(paths.vaultPath, 'After', '.meta.yaml')
      const childMetaPath = path.join(
        paths.vaultPath,
        'After',
        'Child',
        '.meta.yaml',
      )

      expect(getFileAvailability(parentMetaPath).isCloudPlaceholder).toBe(
        false,
      )
      expect(getFileAvailability(childMetaPath).isCloudPlaceholder).toBe(false)
      expect(fs.readFileSync(parentMetaPath, 'utf8')).toContain('name: After')
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('does not exempt or overwrite a moved metadata placeholder', () => {
    const paths = getPaths(tempVaultPath)
    setDatalessProbeForTests(() => true)
    const statSpy = mockFolderMetadataAsZeroBlocks()

    try {
      const storage = createFoldersStorage()
      const parent = storage.createFolder({ name: 'Before' })
      storage.createFolder({ name: 'Child', parentId: parent.id })
      const parentMetaPath = path.join(paths.vaultPath, 'Before', '.meta.yaml')
      const childSourcePath = path.join(
        paths.vaultPath,
        'Before',
        'Child',
        '.meta.yaml',
      )

      makeSparsePlaceholder(childSourcePath)
      resetCloudFileExemptions()
      markAppWrittenFileAsLocal(parentMetaPath)
      const placeholderBefore = fs.readFileSync(childSourcePath)
      const childTargetPath = path.join(
        paths.vaultPath,
        'After',
        'Child',
        '.meta.yaml',
      )
      vi.mocked(enqueueCloudDownload).mockClear()

      storage.updateFolder(parent.id, { name: 'After' })

      expect(fs.readFileSync(childTargetPath)).toEqual(placeholderBefore)
      expect(getFileAvailability(childTargetPath).isCloudPlaceholder).toBe(
        true,
      )
      expect(enqueueCloudDownload).toHaveBeenCalledWith(childTargetPath)
    }
    finally {
      statSpy.mockRestore()
    }
  })
})
