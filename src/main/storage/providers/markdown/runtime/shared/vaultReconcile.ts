import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { BrowserWindow } from 'electron'
import { log } from '../../../../../utils'

// Первый обход только что открытого vault опасен синхронно: листинг
// dataless-каталога облачного провайдера материализуется сетевым запросом,
// и readdirSync блокировал бы main process на каждый каталог. Поэтому
// первый доступ к vault отдаёт мгновенный provisional-кэш из state-индекса
// (без обращений к диску), а обход каталогов выполняется здесь асинхронно:
// материализация происходит в UV threadpool, event loop живёт. После
// обхода запускается обычный синхронный sync (уже быстрый: листинги
// локальны, содержимое плейсхолдеров не читается) и renderer получает
// событие обновления.

const SKIP_WALK_DIR_NAMES = new Set(['.git', 'node_modules'])

export function broadcastStorageSynced(): void {
  try {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('system:storage-synced')
    })
  }
  catch {
    // В тестовом окружении BrowserWindow может быть не замокан.
  }
}

async function materializeDirectoryListings(rootPath: string): Promise<void> {
  const queue: string[] = [rootPath]

  while (queue.length > 0) {
    const currentPath = queue.shift()!

    let entries
    try {
      entries = await fsp.readdir(currentPath, { withFileTypes: true })
    }
    catch {
      continue
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_WALK_DIR_NAMES.has(entry.name)) {
        queue.push(path.join(currentPath, entry.name))
      }
    }
  }
}

export interface VaultReconciler {
  begin: (rootPath: string, runSync: () => void) => void
  isReconciled: (rootPath: string) => boolean
}

// Пауза перед повтором сверки, когда её заблокировал недокачанный
// служебный файл (state.json / .state.yaml сам может быть плейсхолдером).
const RECONCILE_RETRY_MS = 3_000

function isCloudFileNotDownloadedError(error: unknown): boolean {
  return (
    error instanceof Error
    && error.message.startsWith('CLOUD_FILE_NOT_DOWNLOADED')
  )
}

export function createVaultReconciler(label: string): VaultReconciler {
  const reconciledRoots = new Set<string>()
  const pendingRoots = new Set<string>()

  // В тестах vault всегда локальный, а существующие тесты ожидают
  // синхронное поведение sync-функций.
  const bypass = process.env.VITEST !== undefined

  return {
    isReconciled(rootPath: string): boolean {
      return bypass || reconciledRoots.has(rootPath)
    },

    begin(rootPath: string, runSync: () => void): void {
      if (pendingRoots.has(rootPath)) {
        return
      }

      pendingRoots.add(rootPath)

      const attempt = async (): Promise<void> => {
        try {
          await materializeDirectoryListings(rootPath)
          runSync()

          // Успех фиксируется только после того, как настоящая сверка
          // прошла: до этого isReconciled остаётся false, и обращения к
          // vault продолжают получать provisional-кэш.
          reconciledRoots.add(rootPath)
          pendingRoots.delete(rootPath)
          broadcastStorageSynced()
        }
        catch (error) {
          // Служебный файл (state) ещё не докачан из облака: сверка
          // невозможна, но файл уже поставлен в приоритетную докачку —
          // повторяем попытку, пока он не станет доступен.
          if (isCloudFileNotDownloadedError(error)) {
            setTimeout(() => {
              void attempt()
            }, RECONCILE_RETRY_MS)
            return
          }

          log(`storage:${label}:reconcile`, error)
          pendingRoots.delete(rootPath)
        }
      }

      void attempt()
    },
  }
}
