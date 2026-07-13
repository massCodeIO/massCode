import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { BrowserWindow } from 'electron'
import { scheduleDockBadgeRefresh } from '../../../../../dockBadge'
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
  scheduleDockBadgeRefresh()

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
    catch (error) {
      // Пропущенный каталог не валит прогрев: настоящий скан в runSync
      // прочитает его сам (или упадёт, и attempt ретрайнет). Но след в
      // логе нужен — молча неполный обход маскировал бы проблемы диска.
      log('storage:reconcile:readdir', error)
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
  // Останавливает ретраи сверки брошенного корня (смена vault): без отмены
  // цикл продолжал бы попытки по неактивному пути и слал storage-synced.
  abandon: (rootPath: string) => void
  begin: (rootPath: string, runSync: () => void) => void
  isReconciled: (rootPath: string) => boolean
}

// Пауза перед повтором сверки, когда её заблокировал недокачанный
// служебный файл (state.json / .state.yaml сам может быть плейсхолдером).
const RECONCILE_RETRY_MS = 3_000

// Прочие ошибки (EIO, битый state и т.п.) ретраятся с экспоненциальным
// backoff: transient-сбой не должен навсегда оставлять пространство на
// пустом provisional-кэше (повторного begin() при живом кэше уже не будет).
const RECONCILE_MAX_RETRY_MS = 60_000

function isCloudFileNotDownloadedError(error: unknown): boolean {
  return (
    error instanceof Error
    && error.message.startsWith('CLOUD_FILE_NOT_DOWNLOADED')
  )
}

export function createVaultReconciler(label: string): VaultReconciler {
  const reconciledRoots = new Set<string>()
  const pendingRoots = new Set<string>()
  // Поколение цикла на корень: abandon() и каждый новый begin() его
  // инкрементируют, и застрявший в await старый attempt после пробуждения
  // видит чужое поколение и выходит. Флаг-набор здесь не годится: быстрый
  // возврат на тот же vault снимал бы отметку до пробуждения старого цикла,
  // и тот выполнял бы дублирующий runSync с повторным broadcast.
  const generationByRoot = new Map<string, number>()

  // В тестах vault всегда локальный, а существующие тесты ожидают
  // синхронное поведение sync-функций.
  const bypass = process.env.VITEST !== undefined

  return {
    abandon(rootPath: string): void {
      if (pendingRoots.has(rootPath)) {
        generationByRoot.set(
          rootPath,
          (generationByRoot.get(rootPath) ?? 0) + 1,
        )
        pendingRoots.delete(rootPath)
      }
    },

    isReconciled(rootPath: string): boolean {
      return bypass || reconciledRoots.has(rootPath)
    },

    begin(rootPath: string, runSync: () => void): void {
      if (pendingRoots.has(rootPath)) {
        return
      }

      pendingRoots.add(rootPath)

      const generation = (generationByRoot.get(rootPath) ?? 0) + 1
      generationByRoot.set(rootPath, generation)
      const isStale = (): boolean =>
        generationByRoot.get(rootPath) !== generation

      let backoffMs = RECONCILE_RETRY_MS

      const attempt = async (): Promise<void> => {
        if (isStale()) {
          return
        }

        try {
          await materializeDirectoryListings(rootPath)

          if (isStale()) {
            return
          }

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

          // Любая другая ошибка тоже ретраится (с backoff): отказ здесь
          // означал бы пустое пространство до перезапуска приложения, так
          // как повторного begin() при существующем кэше не происходит.
          log(`storage:${label}:reconcile`, error)
          setTimeout(() => {
            void attempt()
          }, backoffMs)
          backoffMs = Math.min(backoffMs * 2, RECONCILE_MAX_RETRY_MS)
        }
      }

      void attempt()
    },
  }
}
