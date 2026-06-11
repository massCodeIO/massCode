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

  it('creates drawings with unique indexed names', () => {
    const first = createDrawing(vaultPath)
    const second = createDrawing(vaultPath)

    expect(first.name).toBe('Untitled')
    expect(second.name).toBe('Untitled 2')
    expect(
      fs.existsSync(path.join(vaultPath, 'drawings', 'Untitled.excalidraw')),
    ).toBe(true)

    const content = readDrawing(vaultPath, first.id)
    expect(content).toContain('"type": "excalidraw"')
  })

  it('lists drawings sorted by name', () => {
    createDrawing(vaultPath, 'Beta')
    createDrawing(vaultPath, 'Alpha')

    const items = listDrawings(vaultPath)

    expect(items.map(item => item.name)).toEqual(['Alpha', 'Beta'])
  })

  it('writes and reads drawing content', () => {
    const record = createDrawing(vaultPath, 'Scene')
    const content = '{"type":"excalidraw","version":2,"elements":[]}'

    writeDrawing(vaultPath, record.id, content)

    expect(readDrawing(vaultPath, record.id)).toBe(content)
  })

  it('renames a drawing and resolves name conflicts', () => {
    createDrawing(vaultPath, 'Taken')
    const record = createDrawing(vaultPath, 'Source')

    const renamed = renameDrawing(vaultPath, record.id, 'Taken')

    expect(renamed?.name).toBe('Taken 2')
    expect(readDrawing(vaultPath, 'Source')).toBeNull()
    expect(readDrawing(vaultPath, 'Taken 2')).not.toBeNull()
  })

  it('duplicates and deletes drawings', () => {
    const record = createDrawing(vaultPath, 'Original')
    const copy = duplicateDrawing(vaultPath, record.id)

    expect(copy?.name).toBe('Original 2')
    expect(listDrawings(vaultPath)).toHaveLength(2)

    expect(deleteDrawing(vaultPath, copy!.id)).toEqual({ deleted: true })
    expect(deleteDrawing(vaultPath, copy!.id)).toEqual({ deleted: false })
    expect(listDrawings(vaultPath)).toHaveLength(1)
  })

  it('sanitizes invalid drawing names', () => {
    expect(sanitizeDrawingName('  My / Draft: v2?  ')).toBe('My Draft v2')
    expect(sanitizeDrawingName('...')).toBe('Untitled')
    expect(sanitizeDrawingName(null)).toBe('Untitled')
    expect(sanitizeDrawingName('con')).toBe('con 1')
  })

  it('rejects drawing ids escaping the drawings directory', () => {
    expect(() => readDrawing(vaultPath, '../outside')).toThrow(/INVALID_NAME/)
  })

  it('keeps drawings files observable by the watcher', () => {
    expect(
      shouldIgnoreWatchPath('/vault', '/vault/drawings/Scene.excalidraw'),
    ).toBe(false)
    expect(isDrawingsWatchPath('drawings/Scene.excalidraw')).toBe(true)
  })
})
