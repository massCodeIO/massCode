import path from 'node:path'
import { app, ipcMain, shell } from 'electron'
import {
  generateIntegrationToken,
  revokeIntegrationToken,
} from '../../api/integrations/auth'
import {
  getCurrencyRates,
  refreshCryptoRatesForced,
  refreshFiatRatesForced,
} from '../../currencyRates'
import { refreshDockBadge, scheduleDockBadgeRefresh } from '../../dockBadge'
import i18n from '../../i18n'
import { activateLicense } from '../../license'
import { getCloudDownloadStatus } from '../../storage/providers/markdown/cloudDownloads'
import {
  getHttpPaths,
  getHttpRuntimeCache,
} from '../../storage/providers/markdown/http'
import {
  findNoteById,
  getNotesFolderPathById,
  getNotesPaths,
  getNotesRuntimeCache,
} from '../../storage/providers/markdown/notes/runtime'
import {
  findSnippetById,
  getPaths,
  getRuntimeCache,
} from '../../storage/providers/markdown/runtime'
import {
  getDirectoryState,
  moveVault,
} from '../../storage/providers/markdown/runtime/moveVault'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import {
  startMarkdownWatcher,
  stopMarkdownWatcher,
} from '../../storage/providers/markdown/watcher'
import { store } from '../../store'
import { installDownloadedUpdate } from '../../updates'
import { log } from '../../utils'

function setVaultPathAndRestartWatcher(vaultPath: string): void {
  const previousVaultPath = store.preferences.get('storage.vaultPath') as
    | string
    | null
    | undefined

  // Сначала останавливаем watcher: pending-записи flush'ятся в текущий vault,
  // а cloud callbacks больше не используют захваченные пути старого vault.
  stopMarkdownWatcher()

  try {
    store.preferences.set('storage.vaultPath', vaultPath)
    startMarkdownWatcher()
    scheduleDockBadgeRefresh()
  }
  catch (error) {
    // Не оставляем приложение на частично запущенном watcher нового vault:
    // возвращаем прежнюю настройку и восстанавливаем старый watcher.
    try {
      stopMarkdownWatcher()
      store.preferences.set('storage.vaultPath', previousVaultPath ?? null)
      startMarkdownWatcher()
    }
    catch (recoveryError) {
      log('storage:markdown:vault-switch-recovery', recoveryError)
    }

    throw error
  }
}

function moveVaultAndRestartWatcher(
  sourcePath: string,
  targetPath: string,
): void {
  // Flush обязан произойти до физического переноса, иначе отложенная запись
  // способна заново создать state-файл в старом каталоге.
  stopMarkdownWatcher()

  try {
    moveVault(sourcePath, targetPath)
  }
  catch (error) {
    // Путь в preferences ещё не менялся — возвращаем watcher старого vault.
    try {
      startMarkdownWatcher()
    }
    catch (recoveryError) {
      log('storage:markdown:vault-move-recovery', recoveryError)
    }

    throw error
  }

  store.preferences.set('storage.vaultPath', targetPath)

  try {
    startMarkdownWatcher()
    scheduleDockBadgeRefresh()
  }
  catch (error) {
    // Файлы уже перенесены, поэтому откат пути небезопасен. Чистый повтор
    // восстанавливает watcher после частично выполненного startup.
    try {
      stopMarkdownWatcher()
      startMarkdownWatcher()
      scheduleDockBadgeRefresh()
      return
    }
    catch (recoveryError) {
      log('storage:markdown:vault-move-watcher-recovery', recoveryError)
    }

    throw error
  }
}

export function registerSystemHandlers() {
  ipcMain.handle('system:activate-license', (_, payload: { key: string }) => {
    return activateLicense(payload.key)
  })

  // Текущий статус фоновой докачки облачных плейсхолдеров: renderer
  // запрашивает его при старте, дальше обновления приходят событием
  // system:cloud-download-progress.
  ipcMain.handle('system:cloud-download-status', () => {
    return getCloudDownloadStatus()
  })

  ipcMain.handle('system:install-update', () => {
    installDownloadedUpdate()
    return true
  })

  ipcMain.handle('system:api-token-generate', () => {
    return generateIntegrationToken()
  })

  ipcMain.handle('system:api-token-revoke', () => {
    revokeIntegrationToken()
    return true
  })

  ipcMain.handle('system:currency-rates', () => {
    return getCurrencyRates()
  })

  ipcMain.handle('system:currency-rates-refresh', () => {
    return refreshFiatRatesForced()
  })

  ipcMain.handle('system:crypto-rates-refresh', () => {
    return refreshCryptoRatesForced()
  })

  ipcMain.handle('system:refresh-dock-badge', () => {
    return refreshDockBadge()
  })

  ipcMain.handle(
    'system:get-directory-state',
    (_, payload: { path: string }) => {
      return getDirectoryState(payload.path)
    },
  )

  ipcMain.handle(
    'system:set-vault-path',
    (_, payload: { vaultPath: string }) => {
      if (typeof payload?.vaultPath !== 'string' || !payload.vaultPath.trim()) {
        throw new Error(i18n.t('messages:error.vaultPathRequired'))
      }

      setVaultPathAndRestartWatcher(payload.vaultPath)

      return { vaultPath: payload.vaultPath }
    },
  )

  ipcMain.handle('system:move-vault', (_, payload: { targetPath: string }) => {
    const sourcePath = getVaultPath()

    moveVaultAndRestartWatcher(sourcePath, payload.targetPath)

    return { vaultPath: payload.targetPath }
  })

  ipcMain.handle('system:reload', () => {
    app.relaunch()
    app.quit()
  })

  ipcMain.handle('system:open-external', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle(
    'system:show-snippet-in-file-manager',
    (_, snippetId: number) => {
      if (!Number.isFinite(snippetId) || snippetId <= 0) {
        return false
      }

      const paths = getPaths(getVaultPath())
      const cache = getRuntimeCache(paths)
      const snippet = findSnippetById(cache.snippets, snippetId)

      if (!snippet) {
        return false
      }

      const snippetAbsolutePath = path.join(paths.vaultPath, snippet.filePath)
      shell.showItemInFolder(snippetAbsolutePath)

      return true
    },
  )

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
    'system:show-http-request-in-file-manager',
    (_, requestId: number) => {
      if (!Number.isFinite(requestId) || requestId <= 0) {
        return false
      }

      const httpPaths = getHttpPaths(getVaultPath())
      const cache = getHttpRuntimeCache(httpPaths)
      const request = cache.requestById.get(requestId)

      if (!request) {
        return false
      }

      const requestAbsolutePath = path.join(
        httpPaths.httpRoot,
        request.filePath,
      )
      shell.showItemInFolder(requestAbsolutePath)

      return true
    },
  )

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
