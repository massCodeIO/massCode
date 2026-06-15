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

function httpRequestSource(id: number, name: string): string {
  return [
    '---',
    `id: ${id}`,
    `name: ${name}`,
    'method: GET',
    'url: https://example.com',
    '---',
    '',
  ].join('\n')
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

  it('reassigns duplicate code snippet ids after a keep-id decision', () => {
    writeFile('code/One.md', snippetSource(10, 'One'))
    writeFile('code/Two.md', snippetSource(10, 'Two'))

    const preview = previewVaultDoctor({ spaces: ['code'] })
    const result = applyVaultDoctor({
      decisions: [
        {
          groupId: preview.conflictGroups[0].id,
          keepPath: 'One.md',
        },
      ],
      spaces: ['code'],
    })

    const one = fs.readFileSync(
      path.join(tempVaultPath, 'code/One.md'),
      'utf8',
    )
    const two = fs.readFileSync(
      path.join(tempVaultPath, 'code/Two.md'),
      'utf8',
    )
    const after = previewVaultDoctor({ spaces: ['code'] })

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'reassign-id',
          path: 'Two.md',
          status: 'applied',
        }),
      ]),
    )
    expect(one).toContain('id: 10')
    expect(two).toContain('id: 11')
    expect(two).toContain('body')
    expect(after.conflictGroups).toHaveLength(0)
  })

  it('includes code inbox files in duplicate id detection', () => {
    writeFile('code/Live.md', snippetSource(10, 'Live'))
    writeFile('code/.masscode/inbox/Inbox.md', snippetSource(10, 'Inbox'))

    const result = previewVaultDoctor({ spaces: ['code'] })

    expect(result.conflictGroups).toHaveLength(1)
    expect(
      result.conflictGroups[0].items.map(item => item.path).sort(),
    ).toEqual(['.masscode/inbox/Inbox.md', 'Live.md'])
  })

  it('ignores notes trash files in duplicate id detection', () => {
    writeFile('notes/Live.md', snippetSource(10, 'Live'))
    writeFile('notes/.masscode/trash/Deleted.md', snippetSource(10, 'Deleted'))

    const result = previewVaultDoctor({ spaces: ['notes'] })

    expect(result.conflictGroups).toHaveLength(0)
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

  it('blocks standalone git separator markers', () => {
    writeFile(
      'notes/Conflict.md',
      ['---', 'id: 1', '---', '======='].join('\n'),
    )

    const result = previewVaultDoctor({ spaces: ['notes'] })

    expect(result.conflictGroups).toHaveLength(1)
    expect(result.conflictGroups[0].reason).toBe('merge-markers')
  })

  it('repairs http environment state while request conflicts remain unresolved', () => {
    writeFile('http/One.md', httpRequestSource(10, 'One'))
    writeFile('http/Two.md', httpRequestSource(10, 'Two'))
    writeFile(
      'http/.state.yaml',
      yaml.dump({
        activeEnvironmentId: 99,
        counters: {
          environmentId: 99,
          folderId: 0,
          historyId: 0,
          requestId: 10,
        },
        environments: [
          {
            id: 1,
            name: 'Broken',
          },
        ],
        folders: [],
        history: [],
        requests: [],
        version: 1,
      }),
    )

    const result = applyVaultDoctor({ spaces: ['http'] })
    const repaired = yaml.load(
      fs.readFileSync(path.join(tempVaultPath, 'http/.state.yaml'), 'utf8'),
    ) as {
      activeEnvironmentId: number | null
      environments: Array<{ variables: Record<string, unknown> }>
    }

    expect(result.conflictGroups).toHaveLength(1)
    expect(result.conflictGroups[0].reason).toBe('duplicate-id')
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'repair-environment-state',
          status: 'applied',
        }),
      ]),
    )
    expect(repaired.activeEnvironmentId).toBeNull()
    expect(repaired.environments[0].variables).toEqual({})
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
