import path from 'node:path'
import { app, ipcMain, shell } from 'electron'
import {
  getCurrencyRates,
  refreshCryptoRatesForced,
  refreshFiatRatesForced,
} from '../../currencyRates'
import {
  findNoteById,
  getNotesFolderPathById,
  getNotesPaths,
  getNotesRuntimeCache,
} from '../../storage/providers/markdown/notes/runtime'
import {
  getDirectoryState,
  moveVault,
} from '../../storage/providers/markdown/runtime/moveVault'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { store } from '../../store'

export function registerSystemHandlers() {
  ipcMain.handle('system:currency-rates', () => {
    return getCurrencyRates()
  })

  ipcMain.handle('system:currency-rates-refresh', () => {
    return refreshFiatRatesForced()
  })

  ipcMain.handle('system:crypto-rates-refresh', () => {
    return refreshCryptoRatesForced()
  })

  ipcMain.handle(
    'system:get-directory-state',
    (_, payload: { path: string }) => {
      return getDirectoryState(payload.path)
    },
  )

  ipcMain.handle('system:move-vault', (_, payload: { targetPath: string }) => {
    const sourcePath = getVaultPath()

    moveVault(sourcePath, payload.targetPath)
    store.preferences.set('storage.vaultPath', payload.targetPath)

    return { vaultPath: payload.targetPath }
  })

  ipcMain.handle('system:reload', () => {
    app.relaunch()
    app.quit()
  })

  ipcMain.handle('system:open-external', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('system:show-note-in-file-manager', (_, noteId: number) => {
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return false
    }

    const notesPaths = getNotesPaths(getVaultPath())
    const cache = getNotesRuntimeCache(notesPaths)
    const note = findNoteById(cache.notes, noteId)

    if (!note) {
      return false
    }

    const noteAbsolutePath = path.join(notesPaths.notesRoot, note.filePath)
    shell.showItemInFolder(noteAbsolutePath)

    return true
  })

  ipcMain.handle(
    'system:show-notes-folder-in-file-manager',
    (_, folderId: number) => {
      if (!Number.isFinite(folderId) || folderId <= 0) {
        return false
      }

      const notesPaths = getNotesPaths(getVaultPath())
      const cache = getNotesRuntimeCache(notesPaths)
      const folderRelativePath = getNotesFolderPathById(cache.state, folderId)

      if (!folderRelativePath) {
        return false
      }

      const folderAbsolutePath = path.join(
        notesPaths.notesRoot,
        folderRelativePath,
      )
      shell.showItemInFolder(folderAbsolutePath)

      return true
    },
  )
}
