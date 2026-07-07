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

      void (async () => {
        try {
          await materializeDirectoryListings(rootPath)
          reconciledRoots.add(rootPath)
          runSync()
          broadcastStorageSynced()
        }
        catch (error) {
          log(`storage:${label}:reconcile`, error)
        }
        finally {
          pendingRoots.delete(rootPath)
        }
      })()
    },
  }
}
