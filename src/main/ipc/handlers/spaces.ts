import type { MathNotebookChange, MathNotebookStore } from '../../store/types'
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
import { isCloudFileNotDownloadedError } from '../../storage/providers/markdown/runtime/shared/guardedRead'
import {
  ensureSpaceDirectory,
  getSpaceStatePath,
} from '../../storage/providers/markdown/runtime/spaces'
import {
  readSpaceState,
  writeSpaceStateImmediate,
} from '../../storage/providers/markdown/runtime/spaceState'
import { store } from '../../store'

// Ответ math:read c облачным плейсхолдером вместо state: renderer получает
// пустой store с флагом pending и ретраит чтение после докачки.
interface MathNotebookReadResult extends MathNotebookStore {
  pending?: boolean
}

function readMathState(statePath: string): MathNotebookStore {
  const state = readSpaceState<MathNotebookStore>(statePath, { fresh: true })
  if (state) {
    return {
      sheets: Array.isArray(state.sheets) ? state.sheets : [],
      activeSheetId: state.activeSheetId ?? null,
    }
  }

  const legacy = {
    sheets: store.mathNotebook.get('sheets') ?? [],
    activeSheetId: store.mathNotebook.get('activeSheetId') ?? null,
  }
  if (legacy.sheets.length)
    writeSpaceStateImmediate(statePath, legacy)
  return legacy
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

    try {
      return readMathState(statePath)
    }
    catch (error) {
      if (!isCloudFileNotDownloadedError(error)) {
        throw error
      }

      // .state.yaml ещё не докачан из облака: guarded-чтение уже поставило
      // его в приоритетную докачку, renderer ретраит по флагу pending.
      return {
        sheets: [],
        activeSheetId: null,
        pending: true,
      } satisfies MathNotebookReadResult
    }
  })

  ipcMain.handle('spaces:math:write', (_, changes: MathNotebookChange[]) => {
    const vaultPath = getVaultPath()

    ensureSpaceDirectory(vaultPath, 'math')
    const statePath = getSpaceStatePath(vaultPath, 'math')
    const state = readMathState(statePath)

    for (const change of changes) {
      switch (change.type) {
        case 'create':
          if (!state.sheets.some(sheet => sheet.id === change.sheet.id))
            state.sheets.push(change.sheet)
          break
        case 'edit': {
          const sheet = state.sheets.find(sheet => sheet.id === change.id)
          if (sheet)
            Object.assign(sheet, change.fields)
          break
        }
        case 'delete':
          state.sheets = state.sheets.filter(sheet => sheet.id !== change.id)
          break
        case 'select':
          state.activeSheetId = change.id
          break
      }
    }

    if (!state.sheets.some(sheet => sheet.id === state.activeSheetId))
      state.activeSheetId = state.sheets[0]?.id ?? null

    writeSpaceStateImmediate(statePath, state)
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
