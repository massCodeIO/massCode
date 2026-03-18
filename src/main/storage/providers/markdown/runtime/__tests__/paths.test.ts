import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPaths } from '../paths'

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

vi.mock('../../../../../store', () => ({
  store: {
    preferences: {
      get: () => undefined,
    },
  },
}))

const tempDirs: string[] = []

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-paths-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop()
    if (tempDir) {
      fs.removeSync(tempDir)
    }
  }
})

describe('getPaths', () => {
  it('migrates legacy code vault root into __spaces__/code', () => {
    const vaultPath = createTempDir()

    fs.ensureDirSync(path.join(vaultPath, '.masscode'))
    fs.writeJSONSync(path.join(vaultPath, '.masscode', 'state.json'), {
      counters: {
        contentId: 0,
        folderId: 1,
        snippetId: 1,
        tagId: 0,
      },
      folders: [
        {
          id: 1,
          name: 'Work',
          orderIndex: 0,
          parentId: null,
        },
      ],
      snippets: [
        {
          filePath: 'Work/demo.md',
          id: 1,
        },
      ],
      tags: [],
      version: 2,
    })

    fs.ensureDirSync(path.join(vaultPath, 'Work'))
    fs.writeFileSync(path.join(vaultPath, 'Work', 'demo.md'), '# Demo')

    const paths = getPaths(vaultPath)

    expect(paths.vaultPath).toBe(path.join(vaultPath, '__spaces__', 'code'))
    expect(
      fs.pathExistsSync(path.join(paths.vaultPath, '.masscode', 'state.json')),
    ).toBe(true)
    expect(
      fs.pathExistsSync(path.join(paths.vaultPath, 'Work', 'demo.md')),
    ).toBe(true)

    expect(fs.pathExistsSync(path.join(vaultPath, '.masscode'))).toBe(false)
    expect(fs.pathExistsSync(path.join(vaultPath, 'Work'))).toBe(false)
  })

  it('keeps existing initialized code space without forced root migration', () => {
    const vaultPath = createTempDir()
    const codeRoot = path.join(vaultPath, '__spaces__', 'code')
    fs.ensureDirSync(path.join(codeRoot, '.masscode'))
    fs.writeJSONSync(path.join(codeRoot, '.masscode', 'state.json'), {
      counters: {
        contentId: 0,
        folderId: 0,
        snippetId: 0,
        tagId: 0,
      },
      folderUi: {},
      snippets: [],
      tags: [],
      version: 2,
    })

    fs.ensureDirSync(path.join(vaultPath, '.masscode'))
    fs.writeJSONSync(path.join(vaultPath, '.masscode', 'state.json'), {
      folders: [
        {
          id: 1,
          name: 'Legacy',
          orderIndex: 0,
          parentId: null,
        },
      ],
      snippets: [
        {
          filePath: 'Legacy/file.md',
          id: 1,
        },
      ],
    })
    fs.ensureDirSync(path.join(vaultPath, 'Legacy'))
    fs.writeFileSync(path.join(vaultPath, 'Legacy', 'file.md'), '# Legacy')

    const paths = getPaths(vaultPath)

    expect(paths.vaultPath).toBe(codeRoot)
    expect(fs.pathExistsSync(path.join(vaultPath, 'Legacy'))).toBe(true)
    expect(fs.pathExistsSync(path.join(codeRoot, 'Legacy'))).toBe(false)
  })

  it('migrates when code space exists but is not initialized', () => {
    const vaultPath = createTempDir()
    const codeRoot = path.join(vaultPath, '__spaces__', 'code')
    fs.ensureDirSync(codeRoot)

    fs.ensureDirSync(path.join(vaultPath, '.masscode'))
    fs.writeJSONSync(path.join(vaultPath, '.masscode', 'state.json'), {
      folders: [
        {
          id: 1,
          name: 'Legacy',
          orderIndex: 0,
          parentId: null,
        },
      ],
      snippets: [
        {
          filePath: 'Legacy/file.md',
          id: 1,
        },
      ],
    })
    fs.ensureDirSync(path.join(vaultPath, 'Legacy'))
    fs.writeFileSync(path.join(vaultPath, 'Legacy', 'file.md'), '# Legacy')

    const paths = getPaths(vaultPath)

    expect(paths.vaultPath).toBe(codeRoot)
    expect(fs.pathExistsSync(path.join(codeRoot, 'Legacy', 'file.md'))).toBe(
      true,
    )
    expect(fs.pathExistsSync(path.join(vaultPath, 'Legacy'))).toBe(false)
  })
})
