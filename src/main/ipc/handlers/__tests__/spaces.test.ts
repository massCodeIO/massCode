import { beforeEach, describe, expect, it, vi } from 'vitest'

const registeredHandlers = new Map<string, (...args: any[]) => unknown>()
const handle = vi.fn(
  (channel: string, handler: (...args: any[]) => unknown) => {
    registeredHandlers.set(channel, handler)
  },
)
const getVaultPath = vi.fn(() => '/fallback-vault')
const createDrawing = vi.fn(() => ({
  id: 'Untitled',
  name: 'Untitled',
  createdAt: 1,
  updatedAt: 1,
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle,
  },
}))

vi.mock('../../../storage/providers/markdown/drawings', () => ({
  createDrawing,
  deleteDrawing: vi.fn(),
  duplicateDrawing: vi.fn(),
  listDrawings: vi.fn(),
  readDrawing: vi.fn(),
  renameDrawing: vi.fn(),
  writeDrawing: vi.fn(),
}))

vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath,
}))

vi.mock('../../../storage/providers/markdown/runtime/spaces', () => ({
  ensureSpaceDirectory: vi.fn(),
  getSpaceStatePath: vi.fn(),
}))

vi.mock('../../../storage/providers/markdown/runtime/spaceState', () => ({
  readSpaceState: vi.fn(),
  writeSpaceState: vi.fn(),
}))

vi.mock('../../../store', () => ({
  store: {
    mathNotebook: {
      get: vi.fn(),
    },
  },
}))

beforeEach(() => {
  registeredHandlers.clear()
  vi.clearAllMocks()
})

describe('registerSpacesHandlers', () => {
  it('creates drawings using the shared vault path resolver', async () => {
    const { registerSpacesHandlers } = await import('../spaces')

    registerSpacesHandlers()

    const result = await registeredHandlers.get('spaces:drawings:create')?.(
      undefined,
      null,
    )

    expect(getVaultPath).toHaveBeenCalled()
    expect(createDrawing).toHaveBeenCalledWith('/fallback-vault', undefined)
    expect(result).toEqual({
      id: 'Untitled',
      name: 'Untitled',
      createdAt: 1,
      updatedAt: 1,
    })
  })
})
