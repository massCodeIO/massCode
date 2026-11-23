import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
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
  getSpaceStatePath: (vaultPath: string) => path.join(vaultPath, '.state.yaml'),
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

  it('reads an externally updated math state and preserves it when selecting or editing another sheet', async () => {
    const { registerSpacesHandlers } = await import('../spaces')
    registerSpacesHandlers()
    const vaultPath = mkdtempSync(path.join(tmpdir(), 'masscode-math-state-'))
    getVaultPath.mockReturnValueOnce(vaultPath)
    const statePath = path.join(vaultPath, '.state.yaml')
    const sheetA = {
      id: 'a',
      name: 'A',
      content: '1 + 1',
      createdAt: 1,
      updatedAt: 1,
    }
    const sheetB = {
      id: 'b',
      name: 'B',
      content: '2 + 2',
      createdAt: 2,
      updatedAt: 2,
    }
    const read = () => registeredHandlers.get('spaces:math:read')?.(undefined)
    const write = registeredHandlers.get('spaces:math:write')

    try {
      writeFileSync(
        statePath,
        yaml.dump({ sheets: [sheetA, sheetB], activeSheetId: 'a' }),
      )
      expect(read()).toMatchObject({ sheets: [sheetA, sheetB] })

      const externalSheetA = { ...sheetA, content: '1 + 10' }
      writeFileSync(
        statePath,
        yaml.dump({ sheets: [externalSheetA, sheetB], activeSheetId: 'a' }),
      )
      getVaultPath.mockReturnValueOnce(vaultPath)
      expect(read()).toMatchObject({ sheets: [externalSheetA, sheetB] })

      const nextExternalSheetA = { ...externalSheetA, content: '1 + 20' }
      writeFileSync(
        statePath,
        yaml.dump({ sheets: [nextExternalSheetA, sheetB], activeSheetId: 'a' }),
      )
      getVaultPath.mockReturnValueOnce(vaultPath)
      write?.(undefined, [
        { type: 'select', id: 'b' },
        {
          type: 'edit',
          id: 'b',
          fields: { content: '2 + 20', updatedAt: 3 },
        },
      ])
      expect(yaml.load(readFileSync(statePath, 'utf8'))).toEqual({
        activeSheetId: 'b',
        sheets: [
          nextExternalSheetA,
          { ...sheetB, content: '2 + 20', updatedAt: 3 },
        ],
      })
    }
    finally {
      rmSync(vaultPath, { recursive: true })
    }
  })
})
