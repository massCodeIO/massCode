import { Buffer } from 'node:buffer'
import { beforeEach, expect, it, vi } from 'vitest'
import { pickNoteImage, writeCapturedNoteImage } from '../noteImagePicker'

const mock = vi.hoisted(() => ({
  vault: '/vault',
  dialog: vi.fn(),
  stat: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  image: vi.fn(),
}))
vi.mock('electron', () => ({
  dialog: { showOpenDialog: mock.dialog },
  clipboard: { readImage: mock.image },
}))
vi.mock('fs-extra', () => ({ lstat: mock.stat, readFile: mock.read }))
vi.mock('../storage/providers/markdown/runtime', () => ({
  getVaultPath: () => mock.vault,
}))
vi.mock('../storage/providers/markdown/runtime/spaces', () => ({
  ensureFlatSpacesLayout: vi.fn(),
}))
vi.mock('../storage/providers/markdown/notes/runtime', () => ({
  getNotesPaths: (vault: string) => ({ root: vault }),
  writeNotesAsset: mock.write,
}))
beforeEach(() => {
  vi.resetAllMocks()
  mock.vault = '/vault'
  mock.dialog.mockResolvedValue({
    canceled: false,
    filePaths: ['/chosen/image.png'],
  })
  mock.stat.mockResolvedValue({
    isFile: () => true,
    isSymbolicLink: () => false,
    size: 3,
  })
  mock.read.mockResolvedValue(Buffer.from([1, 2, 3]))
  mock.write.mockResolvedValue('masscode-asset://notes/image.png')
})
it('rejects a paste/drop queued for an old vault before writing any asset', () => {
  mock.vault = '/new-vault'
  expect(() =>
    writeCapturedNoteImage('/vault', new ArrayBuffer(3), '.png'),
  ).toThrow('Stale')
  expect(mock.write).not.toHaveBeenCalled()
})
it('writes only a native-picker selection and awaits asset persistence', async () => {
  let finish!: (url: string) => void
  mock.write.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve
      }),
  )
  const result = pickNoteImage({ vault: '/vault' })
  await vi.waitFor(() => expect(mock.write).toHaveBeenCalledOnce())
  expect(mock.read).toHaveBeenCalledWith('/chosen/image.png')
  finish('masscode-asset://notes/image.png')
  await expect(result).resolves.toEqual({
    status: 'saved',
    url: 'masscode-asset://notes/image.png',
    bytes: 3,
  })
  await expect(
    pickNoteImage({ vault: '/vault', path: '/unapproved' }),
  ).rejects.toThrow()
})
it('does not read or write after cancellation or a vault switch', async () => {
  mock.dialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
  expect(await pickNoteImage({ vault: '/vault' })).toEqual({
    status: 'cancelled',
  })
  mock.dialog.mockImplementationOnce(async () => {
    mock.vault = '/other'
    return { canceled: false, filePaths: ['/chosen/image.png'] }
  })
  expect(await pickNoteImage({ vault: '/vault' })).toEqual({ status: 'stale' })
  expect(mock.read).not.toHaveBeenCalled()
  expect(mock.write).not.toHaveBeenCalled()
})
it('rejects oversized/non-file selections and reports asset write errors', async () => {
  mock.stat.mockResolvedValueOnce({
    isFile: () => true,
    isSymbolicLink: () => true,
    size: 3,
  })
  expect(await pickNoteImage({ vault: '/vault' })).toEqual({
    status: 'failed',
  })
  mock.stat.mockResolvedValueOnce({
    isFile: () => true,
    isSymbolicLink: () => false,
    size: 11 * 1024 * 1024,
  })
  expect(await pickNoteImage({ vault: '/vault' })).toEqual({
    status: 'failed',
  })
  expect(mock.read).not.toHaveBeenCalled()
  mock.write.mockRejectedValue(new Error('invalid image'))
  expect(await pickNoteImage({ vault: '/vault' })).toEqual({
    status: 'failed',
  })
})

it('captures only the clipboard image as a PNG through the existing asset writer', async () => {
  mock.image.mockReturnValue({
    isEmpty: () => false,
    toPNG: () => Buffer.from([1, 2, 3]),
  })
  expect(
    await pickNoteImage({ vault: '/vault', source: 'clipboardImage' }),
  ).toEqual({
    status: 'saved',
    url: 'masscode-asset://notes/image.png',
    bytes: 3,
  })
  expect(mock.dialog).not.toHaveBeenCalled()
  expect(mock.read).not.toHaveBeenCalled()
  expect(mock.write).toHaveBeenCalledWith(
    { root: '/vault' },
    expect.any(ArrayBuffer),
    '.png',
  )
})
it('rejects empty or oversized clipboard images without writing assets', async () => {
  mock.image
    .mockReturnValueOnce({ isEmpty: () => true })
    .mockReturnValueOnce({
      isEmpty: () => false,
      toPNG: () => Buffer.alloc(10 * 1024 * 1024 + 1),
    })
  expect(
    await pickNoteImage({ vault: '/vault', source: 'clipboardImage' }),
  ).toEqual({ status: 'failed' })
  expect(
    await pickNoteImage({ vault: '/vault', source: 'clipboardImage' }),
  ).toEqual({ status: 'failed' })
  expect(mock.write).not.toHaveBeenCalled()
})
it('rejects stale clipboard captures before reading and after an asynchronous asset write', async () => {
  expect(
    await pickNoteImage({ vault: '/old', source: 'clipboardImage' }),
  ).toEqual({ status: 'stale' })
  expect(mock.image).not.toHaveBeenCalled()
  mock.image.mockReturnValue({
    isEmpty: () => false,
    toPNG: () => Buffer.from([1]),
  })
  mock.write.mockImplementationOnce(async () => {
    mock.vault = '/other'
    return 'masscode-asset://notes/image.png'
  })
  expect(
    await pickNoteImage({ vault: '/vault', source: 'clipboardImage' }),
  ).toEqual({ status: 'stale' })
})
