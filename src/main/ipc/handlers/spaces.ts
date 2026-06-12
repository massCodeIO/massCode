import type { MathNotebookStore } from '../../store/types'
import { ipcMain } from 'electron'
import {
  createDrawing,
  deleteDrawing,
  duplicateDrawing,
  listDrawings,
  readDrawing,
  renameDrawing,
  writeDrawing,
} from '../../storage/providers/markdown/drawings'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import {
  ensureSpaceDirectory,
  getSpaceStatePath,
} from '../../storage/providers/markdown/runtime/spaces'
import {
  readSpaceState,
  writeSpaceState,
} from '../../storage/providers/markdown/runtime/spaceState'
import { store } from '../../store'

export function registerSpacesHandlers() {
  ipcMain.handle('spaces:math:read', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return {
        sheets: [],
        activeSheetId: null,
      } satisfies MathNotebookStore
    }

    ensureSpaceDirectory(vaultPath, 'math')
    const statePath = getSpaceStatePath(vaultPath, 'math')
    const state = readSpaceState<MathNotebookStore>(statePath)

    if (state) {
      return {
        sheets: Array.isArray(state.sheets) ? state.sheets : [],
        activeSheetId: state.activeSheetId ?? null,
      } satisfies MathNotebookStore
    }

    const legacy: MathNotebookStore = {
      sheets: store.mathNotebook.get('sheets') ?? [],
      activeSheetId: store.mathNotebook.get('activeSheetId') ?? null,
    }

    if (legacy.sheets.length > 0) {
      writeSpaceState(statePath, legacy)
    }

    return legacy
  })

  ipcMain.handle('spaces:math:write', (_, data: MathNotebookStore) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return
    }

    ensureSpaceDirectory(vaultPath, 'math')
    const statePath = getSpaceStatePath(vaultPath, 'math')
    writeSpaceState(statePath, data)
  })

  ipcMain.handle('spaces:drawings:list', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return []
    }

    return listDrawings(vaultPath)
  })

  ipcMain.handle('spaces:drawings:read', (_, payload: { id: string }) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return null
    }

    return readDrawing(vaultPath, payload.id)
  })

  ipcMain.handle(
    'spaces:drawings:write',
    (_, payload: { id: string, content: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return writeDrawing(vaultPath, payload.id, payload.content)
    },
  )

  ipcMain.handle(
    'spaces:drawings:create',
    (_, payload: { name?: string | null } | null) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return createDrawing(vaultPath, payload?.name)
    },
  )

  ipcMain.handle(
    'spaces:drawings:rename',
    (_, payload: { id: string, name: string }) => {
      const vaultPath = getVaultPath()
      if (!vaultPath) {
        return null
      }

      return renameDrawing(vaultPath, payload.id, payload.name)
    },
  )

  ipcMain.handle('spaces:drawings:duplicate', (_, payload: { id: string }) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return null
    }

    return duplicateDrawing(vaultPath, payload.id)
  })

  ipcMain.handle('spaces:drawings:delete', (_, payload: { id: string }) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) {
      return { deleted: false }
    }

    return deleteDrawing(vaultPath, payload.id)
  })
}
