import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyVaultDoctor, previewVaultDoctor } from '../doctor'
import { resetHttpRuntimeCache } from '../http/runtime'
import { resetNotesRuntimeCache } from '../notes/runtime'
import { resetRuntimeCache } from '../runtime'

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

vi.mock('../../../../store', () => ({
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

function writeFile(relativePath: string, content: string): void {
  const absolutePath = path.join(tempVaultPath, relativePath)
  fs.ensureDirSync(path.dirname(absolutePath))
  fs.writeFileSync(absolutePath, content, 'utf8')
}

function snippetSource(id: number, name: string): string {
  return ['---', `id: ${id}`, `name: ${name}`, '---', '', 'body'].join('\n')
}

beforeEach(() => {
  tempVaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-doctor-'))
})

afterEach(() => {
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  fs.removeSync(tempVaultPath)
  tempVaultPath = ''
})

describe('vault doctor', () => {
  it('reports duplicate code snippet ids as conflicts that need a decision', () => {
    writeFile('code/One.md', snippetSource(10, 'One'))
    writeFile('code/Two.md', snippetSource(10, 'Two'))

    const result = previewVaultDoctor({ spaces: ['code'] })

    expect(result.conflictGroups).toHaveLength(1)
    expect(result.conflictGroups[0].reason).toBe('duplicate-id')
    expect(result.conflictGroups[0].items.map(item => item.status)).toEqual([
      'needs-decision',
      'needs-decision',
    ])
  })

  it('blocks files with merge markers instead of parsing them as entities', () => {
    writeFile(
      'notes/Conflict.md',
      [
        '<<<<<<< HEAD',
        'name: local',
        '=======',
        'name: remote',
        '>>>>>>> branch',
      ].join('\n'),
    )

    const result = previewVaultDoctor({ spaces: ['notes'] })

    expect(result.conflictGroups).toHaveLength(1)
    expect(result.conflictGroups[0].reason).toBe('merge-markers')
    expect(result.conflictGroups[0].items[0].status).toBe('blocked')
  })

  it('repairs duplicate math sheet ids as a safe state-level fix', () => {
    writeFile(
      'math/.state.yaml',
      yaml.dump({
        activeSheetId: 'sheet-1',
        sheets: [
          {
            content: '1 + 1',
            createdAt: 1,
            id: 'sheet-1',
            name: 'One',
            updatedAt: 1,
          },
          {
            content: '2 + 2',
            createdAt: 2,
            id: 'sheet-1',
            name: 'Two',
            updatedAt: 2,
          },
        ],
      }),
    )

    const preview = previewVaultDoctor({ spaces: ['math'] })
    expect(preview.items).toMatchObject([
      {
        action: 'repair-math-state',
        status: 'pending',
      },
    ])

    applyVaultDoctor({ spaces: ['math'] })

    const repaired = yaml.load(
      fs.readFileSync(path.join(tempVaultPath, 'math/.state.yaml'), 'utf8'),
    ) as { sheets: Array<{ id: string }> }

    expect(new Set(repaired.sheets.map(sheet => sheet.id)).size).toBe(2)
  })
})
