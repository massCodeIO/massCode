import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDrawing,
  deleteDrawing,
  duplicateDrawing,
  listDrawings,
  readDrawing,
  renameDrawing,
  sanitizeDrawingName,
  wasRecentAppDrawingChange,
  writeDrawing,
} from '../drawings'
import {
  getFileAvailability,
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../runtime/shared/cloudFiles'
import { isDrawingsWatchPath, shouldIgnoreWatchPath } from '../watcherPaths'

function makeSparsePlaceholder(absolutePath: string, size = 4096): void {
  fs.removeSync(absolutePath)
  const fd = fs.openSync(absolutePath, 'w')
  fs.ftruncateSync(fd, size)
  fs.closeSync(fd)
}

function mockDrawingFilesAsZeroBlocks() {
  const statSync = fs.statSync.bind(fs)

  return vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
    const stats = statSync(filePath)

    if (
      typeof filePath === 'string'
      && filePath.endsWith('.excalidraw')
      && stats.size > 0
    ) {
      return Object.assign(stats, { blocks: 0 })
    }

    return stats
  })
}

describe('drawings storage', () => {
  let vaultPath: string

  beforeEach(() => {
    vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-drawings-'))
  })

  afterEach(() => {
    setDatalessProbeForTests(null)
    resetCloudFileExemptions()
    fs.rmSync(vaultPath, { force: true, recursive: true })
    vi.restoreAllMocks()
  })

  it('creates drawings with unique indexed names', async () => {
    const first = await createDrawing(vaultPath)
    const second = await createDrawing(vaultPath)

    expect(first.name).toBe('Untitled')
    expect(second.name).toBe('Untitled 2')
    expect(
      fs.existsSync(path.join(vaultPath, 'drawings', 'Untitled.excalidraw')),
    ).toBe(true)

    const content = await readDrawing(vaultPath, first.id)
    expect(content).toContain('"type": "excalidraw"')
  })

  it('lists drawings sorted by name', async () => {
    await createDrawing(vaultPath, 'Beta')
    await createDrawing(vaultPath, 'Alpha')

    const items = await listDrawings(vaultPath)

    expect(items.map(item => item.name)).toEqual(['Alpha', 'Beta'])
  })

  it('writes and reads drawing content', async () => {
    const record = await createDrawing(vaultPath, 'Scene')
    const content = '{"type":"excalidraw","version":2,"elements":[]}'

    const result = await writeDrawing(vaultPath, record.id, content)

    expect(result.updatedAt).toBeGreaterThan(0)
    expect(await readDrawing(vaultPath, record.id)).toBe(content)
  })

  it('keeps app-written zero-block drawings local through mutations', async () => {
    setDatalessProbeForTests(() => true)
    const statSpy = mockDrawingFilesAsZeroBlocks()

    try {
      const created = await createDrawing(vaultPath, 'Resident')
      const sourcePath = path.join(
        vaultPath,
        'drawings',
        'Resident.excalidraw',
      )

      expect(getFileAvailability(sourcePath).isCloudPlaceholder).toBe(false)
      expect(await readDrawing(vaultPath, created.id)).not.toBeNull()

      await writeDrawing(vaultPath, created.id, '{"resident":true}')
      expect(getFileAvailability(sourcePath).isCloudPlaceholder).toBe(false)
      expect(await readDrawing(vaultPath, created.id)).toBe(
        '{"resident":true}',
      )

      const renamed = await renameDrawing(vaultPath, created.id, 'Renamed')
      const renamedPath = path.join(
        vaultPath,
        'drawings',
        'Renamed.excalidraw',
      )
      expect(renamed?.name).toBe('Renamed')
      expect(getFileAvailability(renamedPath).isCloudPlaceholder).toBe(false)
      expect(await readDrawing(vaultPath, renamed!.id)).toBe(
        '{"resident":true}',
      )

      const duplicate = await duplicateDrawing(vaultPath, renamed!.id)
      const duplicatePath = path.join(
        vaultPath,
        'drawings',
        'Renamed 2.excalidraw',
      )
      expect(duplicate?.name).toBe('Renamed 2')
      expect(getFileAvailability(duplicatePath).isCloudPlaceholder).toBe(false)
      expect(await readDrawing(vaultPath, duplicate!.id)).toBe(
        '{"resident":true}',
      )
    }
    finally {
      statSpy.mockRestore()
    }
  })

  it('renames a drawing and resolves name conflicts', async () => {
    await createDrawing(vaultPath, 'Taken')
    const record = await createDrawing(vaultPath, 'Source')

    const renamed = await renameDrawing(vaultPath, record.id, 'Taken')

    expect(renamed?.name).toBe('Taken 2')
    expect(await readDrawing(vaultPath, 'Source')).toBeNull()
    expect(await readDrawing(vaultPath, 'Taken 2')).not.toBeNull()
  })

  it('keeps missing-source rename and duplicate contracts', async () => {
    await expect(
      renameDrawing(vaultPath, 'Missing', 'Renamed'),
    ).resolves.toBeNull()
    await expect(duplicateDrawing(vaultPath, 'Missing')).resolves.toBeNull()
  })

  it('keeps the name on a case-only rename instead of suffixing it', async () => {
    const record = await createDrawing(vaultPath, 'scene')

    const renamed = await renameDrawing(vaultPath, record.id, 'Scene')

    expect(renamed?.name).toBe('Scene')
    expect(await listDrawings(vaultPath)).toHaveLength(1)
  })

  it('does not mark targets moved or copied from genuine placeholders', async () => {
    const record = await createDrawing(vaultPath, 'Cloud')
    const sourcePath = path.join(vaultPath, 'drawings', 'Cloud.excalidraw')
    makeSparsePlaceholder(sourcePath)
    resetCloudFileExemptions()
    setDatalessProbeForTests(() => true)
    const statSpy = mockDrawingFilesAsZeroBlocks()
    const cloudFiles = await import('../runtime/shared/cloudFiles')
    const markSpy = vi.spyOn(cloudFiles, 'markAppWrittenFileAsLocal')

    try {
      const renamed = await renameDrawing(vaultPath, record.id, 'Cloud Moved')
      const renamedPath = path.join(
        vaultPath,
        'drawings',
        'Cloud Moved.excalidraw',
      )

      expect(renamed?.name).toBe('Cloud Moved')
      expect(markSpy).not.toHaveBeenCalled()
      expect(getFileAvailability(renamedPath).isCloudPlaceholder).toBe(true)

      const duplicate = await duplicateDrawing(vaultPath, renamed!.id)
      const duplicatePath = path.join(
        vaultPath,
        'drawings',
        'Cloud Moved 2.excalidraw',
      )

      expect(duplicate?.name).toBe('Cloud Moved 2')
      expect(markSpy).not.toHaveBeenCalled()
      expect(getFileAvailability(duplicatePath).isCloudPlaceholder).toBe(true)
    }
    finally {
      markSpy.mockRestore()
      statSpy.mockRestore()
    }
  })

  it('does not mark files after failed write, move, or copy', async () => {
    const record = await createDrawing(vaultPath, 'Failure')
    const cloudFiles = await import('../runtime/shared/cloudFiles')
    const markSpy = vi.spyOn(cloudFiles, 'markAppWrittenFileAsLocal')
    const writeSpy = vi
      .spyOn(fs, 'writeFile')
      .mockRejectedValueOnce(new Error('write failed'))

    await expect(createDrawing(vaultPath, 'Create Failure')).rejects.toThrow(
      'write failed',
    )
    expect(markSpy).not.toHaveBeenCalled()

    writeSpy.mockRejectedValueOnce(new Error('write failed'))
    await expect(writeDrawing(vaultPath, record.id, '{}')).rejects.toThrow(
      'write failed',
    )
    expect(markSpy).not.toHaveBeenCalled()
    writeSpy.mockRestore()

    const moveSpy = vi
      .spyOn(fs, 'move')
      .mockRejectedValueOnce(new Error('move failed'))
    await expect(renameDrawing(vaultPath, record.id, 'Moved')).rejects.toThrow(
      'move failed',
    )
    expect(markSpy).not.toHaveBeenCalled()
    moveSpy.mockRestore()

    vi.spyOn(fs, 'copy').mockRejectedValueOnce(new Error('copy failed'))
    await expect(duplicateDrawing(vaultPath, record.id)).rejects.toThrow(
      'copy failed',
    )
    expect(markSpy).not.toHaveBeenCalled()
  })

  it('duplicates and deletes drawings', async () => {
    const record = await createDrawing(vaultPath, 'Original')
    const copy = await duplicateDrawing(vaultPath, record.id)

    expect(copy?.name).toBe('Original 2')
    expect(await listDrawings(vaultPath)).toHaveLength(2)

    expect(await deleteDrawing(vaultPath, copy!.id)).toEqual({ deleted: true })
    expect(await deleteDrawing(vaultPath, copy!.id)).toEqual({
      deleted: false,
    })
    expect(await listDrawings(vaultPath)).toHaveLength(1)
  })

  it('remembers own writes for watcher echo suppression', async () => {
    const record = await createDrawing(vaultPath, 'Echo')
    await writeDrawing(vaultPath, record.id, '{}')

    expect(
      wasRecentAppDrawingChange(vaultPath, 'drawings/Echo.excalidraw'),
    ).toBe(true)
    expect(
      wasRecentAppDrawingChange(vaultPath, 'drawings/Other.excalidraw'),
    ).toBe(false)
  })

  it('sanitizes invalid drawing names', () => {
    expect(sanitizeDrawingName('  My / Draft: v2?  ')).toBe('My Draft v2')
    expect(sanitizeDrawingName('...')).toBe('Untitled')
    expect(sanitizeDrawingName(null)).toBe('Untitled')
    expect(sanitizeDrawingName('con')).toBe('con 1')
  })

  it('rejects drawing ids escaping the drawings directory', async () => {
    await expect(readDrawing(vaultPath, '../outside')).rejects.toThrow(
      /INVALID_NAME/,
    )
  })

  it('keeps drawings files observable by the watcher', () => {
    expect(
      shouldIgnoreWatchPath('/vault', '/vault/drawings/Scene.excalidraw'),
    ).toBe(false)
    expect(isDrawingsWatchPath('drawings/Scene.excalidraw')).toBe(true)
  })
})
