import { Buffer } from 'node:buffer'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyVaultDoctor, previewVaultDoctor } from '../doctor'
import { resetHttpRuntimeCache } from '../http/runtime'
import { resetNotesRuntimeCache } from '../notes/runtime'
import { waitForNotesAssetsMigrationForTests } from '../notes/runtime/assetsMigration'
import { resetRuntimeCache } from '../runtime'
import { setDatalessProbeForTests } from '../runtime/shared/cloudFiles'

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
  BrowserWindow: {
    getAllWindows: () => [],
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

function writeSparseFile(relativePath: string): string {
  const absolutePath = path.join(tempVaultPath, relativePath)
  fs.ensureDirSync(path.dirname(absolutePath))
  const descriptor = fs.openSync(absolutePath, 'w')
  fs.ftruncateSync(descriptor, 4096)
  fs.closeSync(descriptor)
  return absolutePath
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
  setDatalessProbeForTests(null)
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  fs.removeSync(tempVaultPath)
  tempVaultPath = ''
})

describe('vault doctor', () => {
  it('reports files missing from the state index as pending registrations', () => {
    // Файл с валидным frontmatter-id, но не зарегистрированный в state:
    // приложение его не отображает, doctor обязан это показать.
    writeFile('code/Orphan.md', snippetSource(5, 'Orphan'))

    const result = previewVaultDoctor({ spaces: ['code'] })

    const item = result.items.find(
      candidate =>
        candidate.action === 'register-file' && candidate.path === 'Orphan.md',
    )
    expect(item?.status).toBe('pending')
  })

  it('registers unindexed files on apply', () => {
    writeFile('code/Orphan.md', snippetSource(5, 'Orphan'))

    applyVaultDoctor({ spaces: ['code'] })

    const preview = previewVaultDoctor({ spaces: ['code'] })
    expect(
      preview.items.filter(item => item.action === 'register-file'),
    ).toHaveLength(0)
  })

  it('warns about notes with folderId pointing to a missing folder', () => {
    writeFile('notes/Projects/.meta.yaml', 'id: 3\nname: Projects\n')
    writeFile(
      'notes/Dangling.md',
      ['---', 'id: 1', 'name: Dangling', 'folderId: 99', '---', 'body'].join(
        '\n',
      ),
    )
    writeFile(
      'notes/Linked.md',
      ['---', 'id: 2', 'name: Linked', 'folderId: 3', '---', 'body'].join('\n'),
    )

    const result = previewVaultDoctor({ spaces: ['notes'] })

    const danglingWarnings = result.warnings.filter(
      warning => warning.code === 'DANGLING_FOLDER_ID',
    )
    expect(danglingWarnings).toHaveLength(1)
    expect(danglingWarnings[0].path).toBe('Dangling.md')
  })

  it('audits only referenced notes assets without changing their bytes', () => {
    const legacyName = 'abcdefghijklmnop.png'
    const equalName = 'ponmlkjihgfedcba.jpg'
    const conflictName = 'abcdefghijklmnopqrstu.jpeg'
    const missingName = 'ponmlkjihgfedcbazyxwv.png'
    const healthyName = 'qrstuvwxyzabcdef.jpg'
    const unknownName = 'zyxwvutsrqponmlk.png'

    writeFile(`notes/assets/${legacyName}`, 'legacy')
    writeFile(`notes/assets/${equalName}`, 'equal')
    writeFile(`notes/.masscode/assets/${equalName}`, 'equal')
    writeFile(`notes/assets/${conflictName}`, 'source')
    writeFile(`notes/.masscode/assets/${conflictName}`, 'destination')
    writeFile(`notes/.masscode/assets/${healthyName}`, 'healthy')
    writeFile(`notes/assets/${unknownName}`, 'unreferenced')
    writeFile(
      'notes/Assets.md',
      [legacyName, equalName, conflictName, missingName, healthyName]
        .map(name => `![](masscode://notes-asset/${name})`)
        .join('\n'),
    )

    const trackedPaths = [
      `notes/assets/${legacyName}`,
      `notes/assets/${equalName}`,
      `notes/.masscode/assets/${equalName}`,
      `notes/assets/${conflictName}`,
      `notes/.masscode/assets/${conflictName}`,
      `notes/.masscode/assets/${healthyName}`,
      `notes/assets/${unknownName}`,
    ]
    const before = trackedPaths.map(relativePath =>
      fs.readFileSync(path.join(tempVaultPath, relativePath)),
    )

    const result = previewVaultDoctor({ spaces: ['notes'] })
    const assetWarnings = result.warnings.filter(warning =>
      warning.code.startsWith('NOTES_'),
    )

    expect(
      assetWarnings.map(warning => [
        warning.code,
        warning.details?.assetName,
        warning.path,
      ]),
    ).toEqual([
      ['NOTES_LEGACY_ASSET', legacyName, 'Assets.md'],
      ['NOTES_LEGACY_ASSET', equalName, 'Assets.md'],
      ['NOTES_ASSET_DESTINATION_CONFLICT', conflictName, 'Assets.md'],
      ['NOTES_ASSET_MISSING', missingName, 'Assets.md'],
    ])
    expect(
      assetWarnings.every(
        warning =>
          Object.keys(warning.details ?? {})
            .sort()
            .join(',') === 'assetName,destination,reason,source',
      ),
    ).toBe(true)
    trackedPaths.forEach((relativePath, index) => {
      expect(fs.readFileSync(path.join(tempVaultPath, relativePath))).toEqual(
        before[index],
      )
    })
  })

  it('reports placeholders as pending and one missing warning per note', () => {
    const pendingName = 'abcdefghijklmnop.png'
    const missingName = 'ponmlkjihgfedcba.jpg'
    const unreadableName = 'qrstuvwxyzabcdef.png'
    const pendingPath = writeSparseFile(`notes/assets/${pendingName}`)
    const unreadableNotePath = path.join(tempVaultPath, 'notes/Unreadable.md')
    writeFile(
      'notes/One.md',
      `![](masscode://notes-asset/${pendingName})\n![](masscode://notes-asset/${missingName})`,
    )
    writeFile('notes/Two.md', `![](masscode://notes-asset/${missingName})`)
    writeFile(
      'notes/Unreadable.md',
      `![](masscode://notes-asset/${unreadableName})`,
    )
    fs.chmodSync(unreadableNotePath, 0o000)
    setDatalessProbeForTests(absolutePath => absolutePath === pendingPath)

    const result = previewVaultDoctor({ spaces: ['notes'] })

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NOTES_ASSET_MIGRATION_PENDING',
          details: expect.objectContaining({
            assetName: pendingName,
            reason: 'source-placeholder',
          }),
          path: 'One.md',
        }),
      ]),
    )
    expect(
      result.warnings
        .filter(
          warning =>
            warning.code === 'NOTES_ASSET_MISSING'
            && warning.details?.assetName === missingName,
        )
        .map(warning => warning.path)
        .sort(),
    ).toEqual(['One.md', 'Two.md'])
    expect(
      result.warnings.some(
        warning => warning.details?.assetName === unreadableName,
      ),
    ).toBe(false)
  })

  it('treats non-regular asset paths as pending without reading them', () => {
    const sourceDirectoryName = 'abcdefghijklmnop.png'
    const destinationDirectoryName = 'ponmlkjihgfedcba.jpg'
    fs.ensureDirSync(
      path.join(tempVaultPath, 'notes/assets', sourceDirectoryName),
    )
    fs.ensureDirSync(
      path.join(
        tempVaultPath,
        'notes/.masscode/assets',
        destinationDirectoryName,
      ),
    )
    writeFile(
      'notes/Directories.md',
      [sourceDirectoryName, destinationDirectoryName]
        .map(name => `![](masscode://notes-asset/${name})`)
        .join('\n'),
    )

    const result = previewVaultDoctor({ spaces: ['notes'] })

    expect(
      result.warnings
        .filter(warning => warning.path === 'Directories.md')
        .map(warning => warning.details?.reason),
    ).toEqual(['source-not-regular', 'destination-not-regular'])
  })

  it.skipIf(process.platform === 'win32')(
    'treats source and destination symlinks as pending without touching targets',
    () => {
      const sourceSymlinkName = 'qrstuvwxyzabcdef.png'
      const destinationSymlinkName = 'fedcbazyxwvutsrq.jpg'
      const externalPath = path.join(tempVaultPath, 'external.bin')
      const externalBytes = Buffer.from([0x10, 0x20, 0x30, 0x40])
      fs.writeFileSync(externalPath, externalBytes)
      fs.ensureDirSync(path.join(tempVaultPath, 'notes/assets'))
      fs.ensureDirSync(path.join(tempVaultPath, 'notes/.masscode/assets'))
      fs.symlinkSync(
        externalPath,
        path.join(tempVaultPath, 'notes/assets', sourceSymlinkName),
      )
      fs.symlinkSync(
        externalPath,
        path.join(
          tempVaultPath,
          'notes/.masscode/assets',
          destinationSymlinkName,
        ),
      )
      writeFile(
        'notes/Symlinks.md',
        [sourceSymlinkName, destinationSymlinkName]
          .map(name => `![](masscode://notes-asset/${name})`)
          .join('\n'),
      )

      const result = previewVaultDoctor({ spaces: ['notes'] })

      expect(
        result.warnings
          .filter(warning => warning.path === 'Symlinks.md')
          .map(warning => warning.details?.reason),
      ).toEqual(['source-symlink', 'destination-symlink'])
      expect(fs.readFileSync(externalPath)).toEqual(externalBytes)
    },
  )

  it('does not migrate referenced legacy assets while applying Notes repairs', async () => {
    const assetName = 'abcdefghijklmnop.png'
    const sourcePath = path.join(tempVaultPath, 'notes/assets', assetName)
    const destinationPath = path.join(
      tempVaultPath,
      'notes/.masscode/assets',
      assetName,
    )
    const assetBytes = Buffer.from([0x01, 0x02, 0xFE, 0xFF])
    fs.ensureDirSync(path.dirname(sourcePath))
    fs.writeFileSync(sourcePath, assetBytes)
    writeFile('notes/Repair.md', `![](masscode://notes-asset/${assetName})`)

    applyVaultDoctor({ spaces: ['notes'] })
    await waitForNotesAssetsMigrationForTests()
    await Promise.resolve()

    expect(fs.readFileSync(sourcePath)).toEqual(assetBytes)
    expect(fs.pathExistsSync(destinationPath)).toBe(false)
  })

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
