import type { MathNotebookStore } from '../../store/types'
import { ipcMain } from 'electron'
import {
  ensureSpaceDirectory,
  getSpaceStatePath,
} from '../../storage/providers/markdown/runtime/spaces'
import {
  readSpaceState,
  writeSpaceState,
} from '../../storage/providers/markdown/runtime/spaceState'
import { store } from '../../store'

function getVaultPath(): string | null {
  return store.preferences.get('storage.vaultPath') as string | null
}

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
}
