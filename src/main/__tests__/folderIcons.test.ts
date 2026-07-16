import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFolderIconPng,
  parseFolderIconSetPayload,
  parseFolderIconTarget,
  parseFolderIconWritePayload,
  resolveFolderIconPath,
  resolveFolderIconResponse,
  setFolderIcon,
  writeFolderIcon,
} from '../folderIcons'

const {
  createFromBuffer,
  folderIconValues,
  fsMock,
  getFileAvailability,
  prioritizeCloudDownload,
  rememberAppFileChange,
  updateCodeFolder,
  updateHttpFolder,
  updateNotesFolder,
} = vi.hoisted(() => ({
  createFromBuffer: vi.fn(),
  folderIconValues: { code: null as string | null },
  fsMock: {
    lstat: vi.fn(),
    readFile: vi.fn(),
    realpathSync: vi.fn((value: string) => value),
    remove: vi.fn(),
    rename: vi.fn(),
    writeFile: vi.fn(),
  },
  getFileAvailability: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
  rememberAppFileChange: vi.fn(),
  updateCodeFolder: vi.fn(),
  updateHttpFolder: vi.fn(),
  updateNotesFolder: vi.fn(),
}))

vi.mock('electron', () => ({
  nativeImage: { createFromBuffer },
}))

vi.mock('fs-extra', () => ({ default: fsMock }))

vi.mock('../storage/providers/markdown/cloudDownloads', () => ({
  prioritizeCloudDownload,
}))

vi.mock('../storage/providers/markdown/runtime/shared/appChanges', () => ({
  rememberAppFileChange,
}))

vi.mock('../storage/providers/markdown/runtime/shared/cloudFiles', () => ({
  getFileAvailability,
}))

vi.mock('../storage', () => ({
  useHttpStorage: () => ({
    folders: {
      getFolders: () => [
        { icon: null, id: 3, name: 'API', parentId: null, orderIndex: 0 },
      ],
      updateFolder: updateHttpFolder,
    },
  }),
  useNotesStorage: () => ({
    folders: {
      getFolders: () => [
        { icon: null, id: 2, name: 'Docs', parentId: null, orderIndex: 0 },
      ],
      updateFolder: updateNotesFolder,
    },
  }),
  useStorage: () => ({
    folders: {
      getFolders: () => [
        {
          icon: folderIconValues.code,
          id: 1,
          name: 'Code',
          parentId: null,
          orderIndex: 0,
        },
      ],
      updateFolder: updateCodeFolder,
    },
  }),
}))

vi.mock('../storage/providers/markdown/runtime', () => ({
  getPaths: () => ({ vaultPath: '/vault/code' }),
  getVaultPath: () => '/vault',
}))

vi.mock('../storage/providers/markdown/notes', () => ({
  getNotesPaths: () => ({ notesRoot: '/vault/notes' }),
}))

vi.mock('../storage/providers/markdown/http', () => ({
  getHttpPaths: () => ({ httpRoot: '/vault/http' }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  folderIconValues.code = null
  fsMock.realpathSync.mockImplementation((value: string) => value)
  getFileAvailability.mockReturnValue({
    exists: false,
    isCloudPlaceholder: false,
    stats: null,
  })
  updateCodeFolder.mockImplementation((_folderId, input) => {
    folderIconValues.code = input.icon
    return { invalidInput: false, notFound: false }
  })
  updateHttpFolder.mockReturnValue({ invalidInput: false, notFound: false })
  updateNotesFolder.mockReturnValue({ invalidInput: false, notFound: false })
})

describe('folder icon payload validation', () => {
  it('accepts valid targets and rejects unknown spaces and ids', () => {
    expect(parseFolderIconTarget({ folderId: 2, spaceId: 'notes' })).toEqual({
      folderId: 2,
      spaceId: 'notes',
    })
    expect(parseFolderIconTarget({ folderId: 0, spaceId: 'notes' })).toBeNull()
    expect(parseFolderIconTarget({ folderId: 2, spaceId: 'math' })).toBeNull()
  })

  it('accepts builtin/null updates and rejects renderer-supplied custom values', () => {
    expect(
      parseFolderIconSetPayload({
        folderId: 1,
        icon: 'lucide:folder-open',
        spaceId: 'code',
      }),
    ).toEqual({ folderId: 1, icon: 'lucide:folder-open', spaceId: 'code' })
    expect(
      parseFolderIconSetPayload({
        folderId: 1,
        icon: null,
        spaceId: 'code',
      }),
    ).toEqual({ folderId: 1, icon: null, spaceId: 'code' })
    expect(
      parseFolderIconSetPayload({
        folderId: 1,
        icon: 'custom:forged',
        spaceId: 'code',
      }),
    ).toBeNull()
  })

  it('accepts PNG/JPEG signatures and rejects arbitrary bytes', () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer
    const jpeg = new Uint8Array([255, 216, 255, 1]).buffer

    expect(
      parseFolderIconWritePayload({
        buffer: png,
        folderId: 1,
        spaceId: 'code',
      }),
    ).not.toBeNull()
    expect(
      parseFolderIconWritePayload({
        buffer: jpeg,
        folderId: 1,
        spaceId: 'code',
      }),
    ).not.toBeNull()
    expect(
      parseFolderIconWritePayload({
        buffer: new Uint8Array([1, 2, 3]).buffer,
        folderId: 1,
        spaceId: 'code',
      }),
    ).toBeNull()
  })
})

describe('folder icon processing', () => {
  it('center-crops and resizes to 128x128 PNG', () => {
    const toPNG = vi.fn(() => Buffer.from('png'))
    const resize = vi.fn(() => ({ toPNG }))
    const crop = vi.fn(() => ({ resize }))
    const decode = vi.fn(() => ({
      crop,
      getSize: () => ({ height: 200, width: 300 }),
      isEmpty: () => false,
    }))

    expect(createFolderIconPng(Buffer.from('input'), decode as never)).toEqual(
      Buffer.from('png'),
    )
    expect(crop).toHaveBeenCalledWith({ height: 200, width: 200, x: 50, y: 0 })
    expect(resize).toHaveBeenCalledWith({
      height: 128,
      quality: 'best',
      width: 128,
    })
  })

  it('rejects an image that cannot be decoded', () => {
    const decode = vi.fn(() => ({ isEmpty: () => true }))

    expect(() =>
      createFolderIconPng(Buffer.from('input'), decode as never),
    ).toThrow('Image could not be decoded')
  })
})

describe('folder icon path resolver', () => {
  it('resolves the icon adjacent to the current folder path', () => {
    expect(resolveFolderIconPath('code', 1)).toBe('/vault/code/Code/.icon.png')
    expect(resolveFolderIconPath('notes', 2)).toBe(
      '/vault/notes/Docs/.icon.png',
    )
    expect(resolveFolderIconPath('http', 3)).toBe('/vault/http/API/.icon.png')
    expect(resolveFolderIconPath('code', 999)).toBeNull()
  })

  it('rejects a folder whose real path escapes the space root', () => {
    fsMock.realpathSync
      .mockReturnValueOnce('/real/vault/code')
      .mockReturnValueOnce('/outside/Code')

    expect(resolveFolderIconPath('code', 1)).toBeNull()
  })
})

describe('folder icon persistence', () => {
  function mockPngEncoding(png = Buffer.from('optimized-png')) {
    createFromBuffer.mockReturnValue({
      crop: () => ({
        resize: () => ({ toPNG: () => png }),
      }),
      getSize: () => ({ height: 256, width: 256 }),
      isEmpty: () => false,
    })
    return png
  }

  it('writes the optimized file and updates folder metadata', async () => {
    fsMock.writeFile.mockResolvedValue(undefined)
    fsMock.rename.mockResolvedValue(undefined)
    fsMock.remove.mockResolvedValue(undefined)
    updateCodeFolder.mockReturnValue({ invalidInput: false, notFound: false })
    const png = mockPngEncoding()

    const value = await writeFolderIcon({
      buffer: new Uint8Array([137, 80, 78, 71]).buffer,
      folderId: 1,
      spaceId: 'code',
    })

    expect(value).toMatch(/^custom:[a-f0-9]{16}$/)
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/vault/code/Code/.icon.png.'),
      png,
      { flag: 'wx' },
    )
    expect(updateCodeFolder).toHaveBeenCalledWith(1, { icon: value })
  })

  it('restores the previous PNG when metadata update fails', async () => {
    const previousPng = Buffer.from('previous-png')
    getFileAvailability.mockReturnValue({
      exists: true,
      isCloudPlaceholder: false,
      stats: { isFile: () => true },
    })
    fsMock.lstat.mockResolvedValue({
      isFile: () => true,
      isSymbolicLink: () => false,
    })
    fsMock.readFile.mockResolvedValueOnce(previousPng)
    fsMock.writeFile.mockResolvedValue(undefined)
    fsMock.rename.mockResolvedValue(undefined)
    fsMock.remove.mockResolvedValue(undefined)
    updateCodeFolder.mockImplementationOnce(() => {
      throw new Error('metadata failed')
    })
    mockPngEncoding()

    await expect(
      writeFolderIcon({
        buffer: new Uint8Array([137, 80, 78, 71]).buffer,
        folderId: 1,
        spaceId: 'code',
      }),
    ).rejects.toThrow('metadata failed')

    expect(fsMock.writeFile).toHaveBeenCalledWith(
      '/vault/code/Code/.icon.png',
      previousPng,
    )
    expect(updateCodeFolder).toHaveBeenLastCalledWith(1, { icon: null })
  })

  it('does not read or overwrite a cloud placeholder', async () => {
    getFileAvailability.mockReturnValue({
      exists: true,
      isCloudPlaceholder: true,
      stats: { isFile: () => true },
    })
    mockPngEncoding()

    await expect(
      writeFolderIcon({
        buffer: new Uint8Array([137, 80, 78, 71]).buffer,
        folderId: 1,
        spaceId: 'code',
      }),
    ).rejects.toThrow('temporarily unavailable')

    expect(prioritizeCloudDownload).toHaveBeenCalledWith(
      '/vault/code/Code/.icon.png',
    )
    expect(fsMock.readFile).not.toHaveBeenCalled()
    expect(fsMock.writeFile).not.toHaveBeenCalled()
  })

  it('updates metadata and removes the adjacent file as one operation', async () => {
    folderIconValues.code = 'custom:old'
    fsMock.remove.mockResolvedValue(undefined)

    await setFolderIcon({ folderId: 1, icon: null, spaceId: 'code' })

    expect(updateCodeFolder).toHaveBeenCalledWith(1, { icon: null })
    expect(fsMock.remove).toHaveBeenCalledWith('/vault/code/Code/.icon.png')
  })

  it('restores metadata when adjacent file cleanup fails', async () => {
    folderIconValues.code = 'custom:old'
    fsMock.remove.mockRejectedValueOnce(new Error('cleanup failed'))

    await expect(
      setFolderIcon({
        folderId: 1,
        icon: null,
        spaceId: 'code',
      }),
    ).rejects.toThrow('cleanup failed')

    expect(updateCodeFolder).toHaveBeenNthCalledWith(1, 1, { icon: null })
    expect(updateCodeFolder).toHaveBeenLastCalledWith(1, {
      icon: 'custom:old',
    })
  })

  it('serializes cleanup before a subsequent upload for the same folder', async () => {
    folderIconValues.code = 'custom:old'
    let finishCleanup!: () => void
    const cleanupPromise = new Promise<void>((resolve) => {
      finishCleanup = resolve
    })
    fsMock.remove.mockReturnValueOnce(cleanupPromise)
    fsMock.writeFile.mockResolvedValue(undefined)
    fsMock.rename.mockResolvedValue(undefined)
    const setPromise = setFolderIcon({
      folderId: 1,
      icon: 'lucide:folder-open',
      spaceId: 'code',
    })
    const png = mockPngEncoding()
    const writePromise = writeFolderIcon({
      buffer: new Uint8Array([137, 80, 78, 71]).buffer,
      folderId: 1,
      spaceId: 'code',
    })

    await Promise.resolve()
    expect(fsMock.writeFile).not.toHaveBeenCalled()

    finishCleanup()
    await setPromise
    await writePromise

    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('/vault/code/Code/.icon.png.'),
      png,
      { flag: 'wx' },
    )
  })
})

describe('folder icon protocol', () => {
  it('queues cloud placeholders instead of reading them', async () => {
    fsMock.lstat.mockResolvedValue({
      isFile: () => true,
      isSymbolicLink: () => false,
    })
    getFileAvailability.mockReturnValue({
      exists: true,
      isCloudPlaceholder: true,
      stats: { isFile: () => true },
    })

    const response = await resolveFolderIconResponse('notes', '2')

    expect(response.status).toBe(503)
    expect(prioritizeCloudDownload).toHaveBeenCalledWith(
      '/vault/notes/Docs/.icon.png',
    )
    expect(fsMock.readFile).not.toHaveBeenCalled()
  })

  it('rejects malformed ids before filesystem access', async () => {
    const response = await resolveFolderIconResponse('code', '1/../2')

    expect(response.status).toBe(404)
    expect(fsMock.lstat).not.toHaveBeenCalled()
  })
})
