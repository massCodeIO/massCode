import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
import { isDrawingsWatchPath, shouldIgnoreWatchPath } from '../watcherPaths'

describe('drawings storage', () => {
  let vaultPath: string

  beforeEach(() => {
    vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-drawings-'))
  })

  afterEach(() => {
    fs.rmSync(vaultPath, { force: true, recursive: true })
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

  it('renames a drawing and resolves name conflicts', async () => {
    await createDrawing(vaultPath, 'Taken')
    const record = await createDrawing(vaultPath, 'Source')

    const renamed = await renameDrawing(vaultPath, record.id, 'Taken')

    expect(renamed?.name).toBe('Taken 2')
    expect(await readDrawing(vaultPath, 'Source')).toBeNull()
    expect(await readDrawing(vaultPath, 'Taken 2')).not.toBeNull()
  })

  it('keeps the name on a case-only rename instead of suffixing it', async () => {
    const record = await createDrawing(vaultPath, 'scene')

    const renamed = await renameDrawing(vaultPath, record.id, 'Scene')

    expect(renamed?.name).toBe('Scene')
    expect(await listDrawings(vaultPath)).toHaveLength(1)
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
