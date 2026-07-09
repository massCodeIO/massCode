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
import { getFileAvailability } from '../../storage/providers/markdown/runtime/shared/cloudFiles'
import { isCloudFileNotDownloadedError } from '../../storage/providers/markdown/runtime/shared/guardedRead'
import {
  ensureSpaceDirectory,
  getSpaceStatePath,
} from '../../storage/providers/markdown/runtime/spaces'
import {
  readSpaceState,
  writeSpaceState,
} from '../../storage/providers/markdown/runtime/spaceState'
import { store } from '../../store'

// Ответ math:read c облачным плейсхолдером вместо state: renderer получает
// пустой store с флагом pending и ретраит чтение после докачки.
interface MathNotebookReadResult extends MathNotebookStore {
  pending?: boolean
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

    let state: MathNotebookStore | null
    try {
      state = readSpaceState<MathNotebookStore>(statePath)
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

    // Запись поверх недокачанного .state.yaml уничтожила бы облачную
    // версию: до докачки писать некуда, renderer и так блокирует persist
    // до первого успешного чтения.
    if (getFileAvailability(statePath).isCloudPlaceholder) {
      return
    }

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
