import type { MarkdownNote, NotesPaths, NotesRuntimeCache } from '../types'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setDatalessProbeForTests } from '../../../runtime/shared/cloudFiles'
import {
  cancelNotesAssetsMigration,
  discoverNotesAssetReferences,
  runNotesAssetsMigration,
  runNotesAssetsMigrationForTests,
  scheduleNotesAssetsMigration,
  waitForNotesAssetsMigrationForTests,
} from '../assetsMigration'

const { enqueueCloudDownload, prioritizeCloudDownload } = vi.hoisted(() => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload,
  prioritizeCloudDownload,
}))

vi.mock('../../../../../../utils', () => ({
  log: vi.fn(),
}))

const tempDirs: string[] = []

function createPaths(): NotesPaths {
  const notesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-migration-'))
  tempDirs.push(notesRoot)
  const metaDirPath = path.join(notesRoot, '.masscode')

  return {
    assetsPath: path.join(metaDirPath, 'assets'),
    inboxDirPath: path.join(metaDirPath, 'inbox'),
    legacyAssetsPath: path.join(notesRoot, 'assets'),
    metaDirPath,
    notesRoot,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, 'trash'),
  }
}

function createNote(
  id: number,
  content: string | null,
  pendingCloudDownload = false,
): MarkdownNote {
  return {
    content,
    createdAt: 1,
    description: null,
    filePath: `Note ${id}.md`,
    folderId: null,
    id,
    isDeleted: 0,
    isFavorites: 0,
    name: `Note ${id}`,
    ...(pendingCloudDownload ? { pendingCloudDownload: true } : {}),
    properties: {},
    tags: [],
    updatedAt: 1,
  }
}

function createCache(
  paths: NotesPaths,
  notes: MarkdownNote[],
): NotesRuntimeCache {
  return {
    folderById: new Map(),
    noteById: new Map(notes.map(note => [note.id, note])),
    notes,
    paths,
    searchIndex: {} as NotesRuntimeCache['searchIndex'],
    state: {
      counters: { folderId: 0, noteId: notes.length, tagId: 0 },
      folderUi: {},
      folders: [],
      notes: notes.map(note => ({ filePath: note.filePath, id: note.id })),
      tags: [],
      version: 1,
    },
  }
}

function assetUrl(fileName: string): string {
  return `![asset](masscode://notes-asset/${fileName})`
}

function writeLegacyAsset(paths: NotesPaths, fileName: string, data: string) {
  fs.ensureDirSync(paths.legacyAssetsPath)
  fs.writeFileSync(path.join(paths.legacyAssetsPath, fileName), data)
}

function writeSparseFile(filePath: string): void {
  fs.ensureDirSync(path.dirname(filePath))
  const fd = fs.openSync(filePath, 'w')
  fs.ftruncateSync(fd, 4096)
  fs.closeSync(fd)
}

afterEach(() => {
  cancelNotesAssetsMigration()
  setDatalessProbeForTests(null)
  vi.clearAllMocks()
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('notes assets migration discovery', () => {
  it('collects only valid references from available note content', () => {
    const paths = createPaths()
    const availableName = 'abcdefghijklmnop.png'
    const pendingName = 'ponmlkjihgfedcba.jpg'
    const cache = createCache(paths, [
      createNote(1, `${assetUrl(availableName)} ${assetUrl('../bad.png')}`),
      createNote(2, assetUrl(pendingName), true),
    ])

    const discovery = discoverNotesAssetReferences(cache)

    expect(discovery.complete).toBe(false)
    expect([...discovery.fileNames]).toEqual([availableName])
    expect(enqueueCloudDownload).toHaveBeenCalledWith(
      path.join(paths.notesRoot, 'Note 2.md'),
    )
  })
})

describe('runNotesAssetsMigration', () => {
  it('migrates only referenced direct legacy assets', async () => {
    const paths = createPaths()
    const referenced = 'abcdefghijklmnop.png'
    const unreferenced = 'ponmlkjihgfedcba.png'
    writeLegacyAsset(paths, referenced, 'referenced bytes')
    writeLegacyAsset(paths, unreferenced, 'unreferenced bytes')

    const summary = await runNotesAssetsMigration(
      createCache(paths, [createNote(1, assetUrl(referenced))]),
    )

    expect(summary.migrated).toBe(1)
    expect(
      fs.readFileSync(path.join(paths.assetsPath, referenced), 'utf8'),
    ).toBe('referenced bytes')
    expect(
      fs.pathExistsSync(path.join(paths.legacyAssetsPath, referenced)),
    ).toBe(false)
    expect(
      fs.pathExistsSync(path.join(paths.legacyAssetsPath, unreferenced)),
    ).toBe(true)
  })

  it('removes a verified equal source and preserves a conflict', async () => {
    const paths = createPaths()
    const equalName = 'abcdefghijklmnop.png'
    const conflictName = 'ponmlkjihgfedcba.jpg'
    writeLegacyAsset(paths, equalName, 'same')
    writeLegacyAsset(paths, conflictName, 'source')
    fs.ensureDirSync(paths.assetsPath)
    fs.writeFileSync(path.join(paths.assetsPath, equalName), 'same')
    fs.writeFileSync(path.join(paths.assetsPath, conflictName), 'destination')

    const summary = await runNotesAssetsMigration(
      createCache(paths, [
        createNote(1, `${assetUrl(equalName)} ${assetUrl(conflictName)}`),
      ]),
    )

    expect(summary.removedEqual).toBe(1)
    expect(summary.conflicts).toBe(1)
    expect(
      fs.pathExistsSync(path.join(paths.legacyAssetsPath, equalName)),
    ).toBe(false)
    expect(
      fs.readFileSync(path.join(paths.legacyAssetsPath, conflictName), 'utf8'),
    ).toBe('source')
    expect(
      fs.readFileSync(path.join(paths.assetsPath, conflictName), 'utf8'),
    ).toBe('destination')
  })

  it('re-evaluates atomic EEXIST without overwriting a concurrent destination', async () => {
    const paths = createPaths()
    const fileName = 'abcdefghijklmnop.png'
    writeLegacyAsset(paths, fileName, 'source')

    const summary = await runNotesAssetsMigrationForTests(
      createCache(paths, [createNote(1, assetUrl(fileName))]),
      () => false,
      {
        beforePublish: ({ destinationPath }) => {
          fs.writeFileSync(destinationPath, 'concurrent')
        },
      },
    )

    expect(summary.conflicts).toBe(1)
    expect(fs.readFileSync(path.join(paths.assetsPath, fileName), 'utf8')).toBe(
      'concurrent',
    )
    expect(
      fs.readFileSync(path.join(paths.legacyAssetsPath, fileName), 'utf8'),
    ).toBe('source')
  })

  it('does not remove a concurrent replacement after publish mismatch', async () => {
    const paths = createPaths()
    const fileName = 'abcdefghijklmnop.png'
    writeLegacyAsset(paths, fileName, 'source')

    const summary = await runNotesAssetsMigrationForTests(
      createCache(paths, [createNote(1, assetUrl(fileName))]),
      () => false,
      {
        afterPublish: ({ destinationPath }) => {
          fs.unlinkSync(destinationPath)
          fs.writeFileSync(destinationPath, 'replacement')
        },
      },
    )

    expect(summary.conflicts).toBe(1)
    expect(fs.readFileSync(path.join(paths.assetsPath, fileName), 'utf8')).toBe(
      'replacement',
    )
    expect(fs.pathExistsSync(path.join(paths.legacyAssetsPath, fileName))).toBe(
      true,
    )
  })

  it('removes an owned post-publish mismatch and always cleans its temp', async () => {
    const paths = createPaths()
    const fileName = 'abcdefghijklmnop.png'
    writeLegacyAsset(paths, fileName, 'source')

    const summary = await runNotesAssetsMigrationForTests(
      createCache(paths, [createNote(1, assetUrl(fileName))]),
      () => false,
      {
        afterPublish: ({ destinationPath }) => {
          fs.writeFileSync(destinationPath, 'corrupt')
        },
      },
    )

    expect(summary.conflicts).toBe(1)
    expect(fs.pathExistsSync(path.join(paths.assetsPath, fileName))).toBe(
      false,
    )
    expect(fs.readdirSync(paths.assetsPath)).toEqual([])
    expect(fs.pathExistsSync(path.join(paths.legacyAssetsPath, fileName))).toBe(
      true,
    )
  })

  it('checks cancellation immediately before final source deletion', async () => {
    const paths = createPaths()
    const fileName = 'abcdefghijklmnop.png'
    writeLegacyAsset(paths, fileName, 'source')
    let cancelled = false

    const summary = await runNotesAssetsMigrationForTests(
      createCache(paths, [createNote(1, assetUrl(fileName))]),
      () => cancelled,
      {
        afterFinalDestinationHash: () => {
          cancelled = true
        },
      },
    )

    expect(summary.deferred).toBe(1)
    expect(fs.pathExistsSync(path.join(paths.legacyAssetsPath, fileName))).toBe(
      true,
    )
    expect(fs.readFileSync(path.join(paths.assetsPath, fileName), 'utf8')).toBe(
      'source',
    )
  })

  it('preserves a source replaced during final destination verification', async () => {
    const paths = createPaths()
    const fileName = 'abcdefghijklmnop.png'
    writeLegacyAsset(paths, fileName, 'source')

    const summary = await runNotesAssetsMigrationForTests(
      createCache(paths, [createNote(1, assetUrl(fileName))]),
      () => false,
      {
        afterFinalDestinationHash: ({ sourcePath }) => {
          fs.unlinkSync(sourcePath)
          fs.writeFileSync(sourcePath, 'replacement source')
        },
      },
    )

    expect(summary.conflicts).toBe(1)
    expect(
      fs.readFileSync(path.join(paths.legacyAssetsPath, fileName), 'utf8'),
    ).toBe('replacement source')
    expect(fs.pathExistsSync(path.join(paths.assetsPath, fileName))).toBe(
      false,
    )
  })

  it('defers placeholders and prioritizes their hydration', async () => {
    const paths = createPaths()
    const sourceName = 'abcdefghijklmnop.png'
    const destinationName = 'ponmlkjihgfedcba.jpg'
    fs.ensureDirSync(paths.legacyAssetsPath)
    writeLegacyAsset(paths, destinationName, 'source bytes')
    fs.ensureDirSync(paths.assetsPath)
    const sourcePath = path.join(paths.legacyAssetsPath, sourceName)
    const destinationPath = path.join(paths.assetsPath, destinationName)
    writeSparseFile(sourcePath)
    writeSparseFile(destinationPath)
    setDatalessProbeForTests(
      absolutePath =>
        absolutePath === sourcePath || absolutePath === destinationPath,
    )

    const summary = await runNotesAssetsMigration(
      createCache(paths, [
        createNote(1, `${assetUrl(sourceName)} ${assetUrl(destinationName)}`),
      ]),
    )

    expect(summary.deferred).toBe(2)
    expect(prioritizeCloudDownload).toHaveBeenCalledWith(sourcePath)
    expect(prioritizeCloudDownload).toHaveBeenCalledWith(destinationPath)
    expect(fs.pathExistsSync(sourcePath)).toBe(true)
  })

  it('isolates one item error and continues migrating the next asset', async () => {
    const paths = createPaths()
    const badName = 'abcdefghijklmnop.png'
    const goodName = 'ponmlkjihgfedcba.jpg'
    fs.ensureDirSync(path.join(paths.legacyAssetsPath, badName))
    writeLegacyAsset(paths, goodName, 'good bytes')

    const summary = await runNotesAssetsMigration(
      createCache(paths, [
        createNote(1, `${assetUrl(badName)} ${assetUrl(goodName)}`),
      ]),
    )

    expect(summary.errors).toBe(1)
    expect(summary.migrated).toBe(1)
    expect(fs.pathExistsSync(path.join(paths.assetsPath, goodName))).toBe(true)
  })

  it('is idempotent and discovers a late reference on a future run', async () => {
    const paths = createPaths()
    const firstName = 'abcdefghijklmnop.png'
    const lateName = 'ponmlkjihgfedcba.jpg'
    writeLegacyAsset(paths, firstName, 'first')
    writeLegacyAsset(paths, lateName, 'late')
    const cache = createCache(paths, [createNote(1, assetUrl(firstName))])

    expect((await runNotesAssetsMigration(cache)).migrated).toBe(1)
    expect((await runNotesAssetsMigration(cache)).migrated).toBe(0)

    cache.notes.push(createNote(2, assetUrl(lateName)))
    expect((await runNotesAssetsMigration(cache)).migrated).toBe(1)
    expect(fs.pathExistsSync(path.join(paths.assetsPath, lateName))).toBe(true)
  })

  it('cancels a scheduled run before rename or source deletion', async () => {
    const paths = createPaths()
    const fileName = 'abcdefghijklmnop.png'
    writeLegacyAsset(paths, fileName, 'source')

    scheduleNotesAssetsMigration(
      createCache(paths, [createNote(1, assetUrl(fileName))]),
    )
    cancelNotesAssetsMigration()
    await waitForNotesAssetsMigrationForTests()

    expect(fs.pathExistsSync(path.join(paths.legacyAssetsPath, fileName))).toBe(
      true,
    )
    expect(fs.pathExistsSync(path.join(paths.assetsPath, fileName))).toBe(
      false,
    )
  })
})
