import type { NotesPaths } from '../types'
import { Buffer } from 'node:buffer'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import { setDatalessProbeForTests } from '../../../runtime/shared/cloudFiles'
import {
  parseNotesAssetName,
  parseNotesAssetWritePayload,
  resolveNotesAsset,
  writeNotesAsset,
} from '../assets'

const tempDirs: string[] = []

function createNotesPaths(): NotesPaths {
  const notesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-assets-'))
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

function pngBytes(): ArrayBuffer {
  return Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00])
    .buffer
}

function jpegBytes(): ArrayBuffer {
  return Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9]).buffer
}

afterEach(() => {
  setDatalessProbeForTests(null)
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('notes asset validation', () => {
  it('accepts current and historical generated names case-insensitively', () => {
    expect(parseNotesAssetName('abcdefghijklmnop.PNG')).toMatchObject({
      extension: '.png',
      mimeType: 'image/png',
    })
    expect(parseNotesAssetName('abcdefghijklmnopqrstu.JpEg')).toMatchObject({
      extension: '.jpeg',
      mimeType: 'image/jpeg',
    })
  })

  it.each([
    '../abcdefghijklmnop.png',
    '..%2Fabcdefghijklmnop.png',
    '%2e%2e%5cabcdefghijklmnop.png',
    'short.png',
    'abcdefghijklmnop.exe',
  ])('rejects unsafe or unsupported name %s', (fileName) => {
    expect(parseNotesAssetName(fileName)).toBeNull()
  })

  it('accepts only an object with string ext and ArrayBuffer bytes', () => {
    expect(parseNotesAssetWritePayload(null)).toBeNull()
    expect(parseNotesAssetWritePayload({ buffer: [0], ext: 1 })).toBeNull()
    expect(
      parseNotesAssetWritePayload({ buffer: [0, 1], ext: '.png' }),
    ).toBeNull()
    expect(
      parseNotesAssetWritePayload({ buffer: pngBytes(), ext: '.png' }),
    ).toMatchObject({ ext: '.png' })
  })
})

describe('writeNotesAsset', () => {
  it('writes atomically to the managed root and returns the stable URL', async () => {
    const paths = createNotesPaths()
    const url = await writeNotesAsset(
      paths,
      pngBytes(),
      '.PNG',
      () => 'abcdefghijklmnop',
    )

    expect(url).toBe('masscode://notes-asset/abcdefghijklmnop.png')
    expect(
      fs.readFileSync(path.join(paths.assetsPath, 'abcdefghijklmnop.png')),
    ).toEqual(Buffer.from(pngBytes()))
    expect(fs.pathExistsSync(paths.legacyAssetsPath)).toBe(false)
    expect(fs.readdirSync(paths.assetsPath)).toEqual(['abcdefghijklmnop.png'])
  })

  it('accepts a JPEG signature for JPG uploads', async () => {
    const paths = createNotesPaths()

    const url = await writeNotesAsset(
      paths,
      jpegBytes(),
      '.JPG',
      () => 'abcdefghijklmnop',
    )

    expect(url).toBe('masscode://notes-asset/abcdefghijklmnop.jpg')
  })

  it('rejects SVG, mismatched bytes, and an existing destination', async () => {
    const paths = createNotesPaths()
    await expect(
      writeNotesAsset(paths, new TextEncoder().encode('<svg/>').buffer, '.svg'),
    ).rejects.toThrow('Unsupported')
    await expect(
      writeNotesAsset(
        paths,
        new TextEncoder().encode('not png').buffer,
        '.png',
      ),
    ).rejects.toThrow('does not match')

    fs.ensureDirSync(paths.assetsPath)
    const destination = path.join(paths.assetsPath, 'abcdefghijklmnop.png')
    fs.writeFileSync(destination, 'existing')
    await expect(
      writeNotesAsset(paths, pngBytes(), '.png', () => 'abcdefghijklmnop'),
    ).rejects.toThrow('already exists')
    expect(fs.readFileSync(destination, 'utf8')).toBe('existing')
    expect(fs.readdirSync(paths.assetsPath)).toEqual(['abcdefghijklmnop.png'])
  })
})

describe('resolveNotesAsset', () => {
  it('prefers the managed root and falls back to legacy', async () => {
    const paths = createNotesPaths()
    const fileName = 'abcdefghijklmnop.png'
    fs.ensureDirSync(paths.assetsPath)
    fs.ensureDirSync(paths.legacyAssetsPath)
    fs.writeFileSync(path.join(paths.assetsPath, fileName), 'new')
    fs.writeFileSync(path.join(paths.legacyAssetsPath, fileName), 'legacy')

    const preferred = await resolveNotesAsset(fileName, paths)
    expect(await preferred.text()).toBe('new')
    fs.removeSync(path.join(paths.assetsPath, fileName))

    const fallback = await resolveNotesAsset(fileName, paths)
    expect(await fallback.text()).toBe('legacy')
    expect(fallback.headers.get('Content-Type')).toBe('image/png')
  })

  it('does not mask a managed placeholder with a legacy file', async () => {
    const paths = createNotesPaths()
    const fileName = 'abcdefghijklmnop.png'
    const managedPath = path.join(paths.assetsPath, fileName)
    fs.ensureDirSync(paths.assetsPath)
    fs.ensureDirSync(paths.legacyAssetsPath)
    const placeholderFd = fs.openSync(managedPath, 'w')
    fs.ftruncateSync(placeholderFd, 4096)
    fs.closeSync(placeholderFd)
    fs.writeFileSync(path.join(paths.legacyAssetsPath, fileName), 'legacy')
    setDatalessProbeForTests(absolutePath => absolutePath === managedPath)
    const prioritized: string[] = []

    const response = await resolveNotesAsset(fileName, paths, absolutePath =>
      prioritized.push(absolutePath))

    expect(response.status).toBe(503)
    expect(prioritized).toEqual([managedPath])
    expect(await response.text()).not.toBe('legacy')
  })

  it('returns a safe 404 for traversal', async () => {
    const response = await resolveNotesAsset(
      '..%2Fabcdefghijklmnop.png',
      createNotesPaths(),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('serves legacy SVG with active content blocked', async () => {
    const paths = createNotesPaths()
    const fileName = 'abcdefghijklmnop.svg'
    fs.ensureDirSync(paths.legacyAssetsPath)
    fs.writeFileSync(path.join(paths.legacyAssetsPath, fileName), '<svg/>')

    const response = await resolveNotesAsset(fileName, paths)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(response.headers.get('Content-Security-Policy')).toContain(
      'sandbox',
    )
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it.runIf(process.platform !== 'win32')(
    'does not follow a direct asset file symlink',
    async () => {
      const fileName = 'abcdefghijklmnop.png'
      const outsideRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'notes-outside-'),
      )
      tempDirs.push(outsideRoot)
      fs.writeFileSync(path.join(outsideRoot, fileName), 'outside')

      const fileSymlinkPaths = createNotesPaths()
      fs.ensureDirSync(fileSymlinkPaths.assetsPath)
      fs.symlinkSync(
        path.join(outsideRoot, fileName),
        path.join(fileSymlinkPaths.assetsPath, fileName),
      )
      expect((await resolveNotesAsset(fileName, fileSymlinkPaths)).status).toBe(
        404,
      )
    },
  )
})
