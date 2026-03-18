import type { Paths } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSnippetFromFile } from '../snippets'

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

function createPaths(): Paths {
  const vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'snippets-runtime-'))
  tempDirs.push(vaultPath)
  const metaDirPath = path.join(vaultPath, '.masscode')

  return {
    inboxDirPath: path.join(metaDirPath, 'inbox'),
    metaDirPath,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, 'trash'),
    vaultPath,
  }
}

afterEach(() => {
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('readSnippetFromFile', () => {
  it('parses quoted ISO timestamps from frontmatter as stable unix ms', () => {
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date('2026-03-18T19:40:00.000Z'))

      const paths = createPaths()
      const relativePath = '.masscode/inbox/legacy-date-snippet.md'
      const absolutePath = path.join(paths.vaultPath, relativePath)
      const createdAtIso = '2026-03-18T10:00:00.000Z'
      const updatedAtIso = '2026-03-18T11:00:00.000Z'
      const source = [
        '---',
        'id: 10',
        'name: Legacy Date Snippet',
        `createdAt: "${createdAtIso}"`,
        `updatedAt: "${updatedAtIso}"`,
        'contents:',
        '  - id: 1',
        '    label: Fragment 1',
        '    language: plain_text',
        '---',
        '',
        '## Fragment: Fragment 1',
        '```plain_text',
        'body',
        '```',
        '',
      ].join('\n')

      fs.ensureDirSync(path.dirname(absolutePath))
      fs.writeFileSync(absolutePath, source, 'utf8')

      const snippet = readSnippetFromFile(
        paths,
        { filePath: relativePath, id: 10 },
        new Map(),
      )

      expect(snippet).not.toBeNull()
      expect(snippet?.createdAt).toBe(new Date(createdAtIso).getTime())
      expect(snippet?.updatedAt).toBe(new Date(updatedAtIso).getTime())
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('keeps timestamps stable for markdown files without frontmatter', () => {
    vi.useFakeTimers()

    try {
      const paths = createPaths()
      const relativePath = '.masscode/inbox/plain.md'
      const absolutePath = path.join(paths.vaultPath, relativePath)
      fs.ensureDirSync(path.dirname(absolutePath))
      fs.writeFileSync(absolutePath, '# Plain markdown snippet', 'utf8')

      vi.setSystemTime(new Date('2026-03-18T10:00:00.000Z'))
      const firstRead = readSnippetFromFile(
        paths,
        { filePath: relativePath, id: 11 },
        new Map(),
      )

      vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'))
      const secondRead = readSnippetFromFile(
        paths,
        { filePath: relativePath, id: 11 },
        new Map(),
      )

      expect(firstRead).not.toBeNull()
      expect(secondRead).not.toBeNull()
      expect(secondRead?.createdAt).toBe(firstRead?.createdAt)
      expect(secondRead?.updatedAt).toBe(firstRead?.updatedAt)
    }
    finally {
      vi.useRealTimers()
    }
  })
})
