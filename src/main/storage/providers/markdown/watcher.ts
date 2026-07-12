import type { ChokidarOptions, FSWatcher } from 'chokidar'
import type { NotesPaths, NotesRuntimeCache } from './notes/runtime'
import path from 'node:path'
import { importEsm, log } from '../../../utils'
import {
  configureCloudDownloads,
  getPendingCloudPaths,
  resetCloudDownloads,
} from './cloudDownloads'
import { wasRecentAppDrawingChange } from './drawings'
import {
  getHttpPaths,
  type HttpPaths,
  peekHttpRuntimeCache,
  resetHttpRuntimeCache,
  syncHttpRuntimeWithDisk,
} from './http'
import {
  getNotesPaths,
  peekNotesRuntimeCache,
  refreshPendingNoteFiles,
  resetNotesPathsCache,
  resetNotesRuntimeCache,
  syncNoteFileWithDisk,
  syncNotesRuntimeWithDisk,
} from './notes/runtime'
import {
  ensureStateFile,
  getPaths,
  getVaultPath,
  type MarkdownRuntimeCache,
  type Paths,
  peekRuntimeCache,
  refreshPendingSnippetFiles,
  resetPathsCache,
  resetRuntimeCache,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
} from './runtime'
import { wasRecentAppFileChange } from './runtime/shared/appChanges'
import { getFileAvailability } from './runtime/shared/cloudFiles'
import { isCloudFileNotDownloadedError } from './runtime/shared/guardedRead'
import { broadcastStorageSynced } from './runtime/shared/vaultReconcile'
import {
  getWatchPathSpaceId,
  isCodeWatchPath,
  isDrawingsWatchPath,
  isHttpWatchPath,
  isMathWatchPath,
  isNotesWatchPath,
  normalizeRelativeWatchPath,
  shouldIgnoreWatchPath,
  toCodeRelativePath,
  toNotesRelativePath,
} from './watcherPaths'

// Above this number of buffered file changes an incremental per-file sync
// is unlikely to beat one full re-read, so the watcher escalates instead.
const MAX_PENDING_SYNC_FILE_PATHS = 25
// Верхняя граница дебаунса: даже под непрерывным потоком событий буфер
// изменений сбрасывается не реже, чем раз в эту паузу. Значение балансирует
// отзывчивость UI и стоимость sync-циклов во время шторма фоновых докачек.
const MAX_PENDING_SYNC_AGE_MS = 2_000

// Пауза между проходами self-heal: перепроверка недокачанных записей после
// того, как облако (особенно iCloud) материализовало файлы без fs-событий.
const CLOUD_REFRESH_INTERVAL_MS = 3_000

let markdownWatcher: FSWatcher | null = null
let markdownWatchTimer: NodeJS.Timeout | null = null
let pendingSyncSince: number | null = null
let cloudRefreshTimer: NodeJS.Timeout | null = null
let watchedVaultPath: string | null = null
const pendingCodeFilePaths = new Set<string>()
const pendingNoteFilePaths = new Set<string>()
let hasPendingFullSync = false
let hasPendingMathSync = false
let hasPendingNotesSync = false
let hasPendingHttpSync = false
let hasPendingDrawingsSync = false
let watcherStartToken = 0
let chokidarWatchLoader: Promise<ChokidarWatch> | null = null

type ChokidarWatch = (
  path: string | readonly string[],
  options?: ChokidarOptions,
) => FSWatcher

async function getChokidarWatch(): Promise<ChokidarWatch> {
  if (chokidarWatchLoader) {
    return chokidarWatchLoader
  }

  chokidarWatchLoader = importEsm('chokidar')
    .then((module) => {
      const chokidarModule = module as {
        default?: {
          watch?: unknown
        }
        watch?: unknown
      }
      const watch = chokidarModule.default?.watch || chokidarModule.watch

      if (typeof watch !== 'function') {
        throw new TypeError('chokidar.watch is not available')
      }

      return watch as ChokidarWatch
    })
    .catch((error) => {
      chokidarWatchLoader = null
      throw error
    })

  return chokidarWatchLoader
}

function syncChangedSnippetFiles(
  paths: Paths,
  changedFilePaths: string[],
): MarkdownRuntimeCache {
  let nextCache: MarkdownRuntimeCache | null = null

  for (const changedFilePath of changedFilePaths) {
    nextCache = syncSnippetFileWithDisk(paths, changedFilePath)
    if (!nextCache) {
      return syncRuntimeWithDisk(paths)
    }
  }

  return nextCache ?? syncRuntimeWithDisk(paths)
}

function syncChangedNoteFiles(
  notesPaths: NotesPaths,
  changedFilePaths: string[],
): NotesRuntimeCache {
  let nextCache: NotesRuntimeCache | null = null

  for (const changedFilePath of changedFilePaths) {
    nextCache = syncNoteFileWithDisk(notesPaths, changedFilePath)
    if (!nextCache) {
      return syncNotesRuntimeWithDisk(notesPaths)
    }
  }

  return nextCache ?? syncNotesRuntimeWithDisk(notesPaths)
}

function scheduleStateSync(
  vaultRootPath: string,
  paths: Paths,
  changedPath: string | null,
  forceFullSync = false,
): void {
  const changedSpaceId = getWatchPathSpaceId(changedPath)
  if (changedPath && !changedSpaceId) {
    return
  }

  const changedNotesPath = isNotesWatchPath(changedPath)
  const changedCodePath = isCodeWatchPath(changedPath)
  const changedMathPath = isMathWatchPath(changedPath)
  const changedHttpPath = isHttpWatchPath(changedPath)
  const changedDrawingsPath = isDrawingsWatchPath(changedPath)
  const changedCodeRelativePath
    = changedPath && changedCodePath ? toCodeRelativePath(changedPath) : null

  // Echoes of the app's own file writes are skipped entirely: the runtime
  // caches were already updated by the storage layer before the write.
  const isAppEcho
    = changedPath !== null
      && !forceFullSync
      && (changedNotesPath || changedCodePath)
      && wasRecentAppFileChange(path.join(vaultRootPath, changedPath))

  if (changedNotesPath && !isAppEcho) {
    const changedNoteRelativePath
      = changedPath && !forceFullSync ? toNotesRelativePath(changedPath) : null

    if (changedNoteRelativePath) {
      pendingNoteFilePaths.add(changedNoteRelativePath)
      if (pendingNoteFilePaths.size > MAX_PENDING_SYNC_FILE_PATHS) {
        hasPendingNotesSync = true
      }
    }
    else {
      hasPendingNotesSync = true
    }
  }

  if (changedMathPath) {
    hasPendingMathSync = true
  }

  if (changedHttpPath) {
    hasPendingHttpSync = true
  }

  if (
    changedDrawingsPath
    && !(changedPath && wasRecentAppDrawingChange(vaultRootPath, changedPath))
  ) {
    // Echoes of the app's own drawing writes are skipped entirely:
    // re-syncing them would only re-read data the renderer already has.
    hasPendingDrawingsSync = true
  }

  if (changedNotesPath) {
    // Notes space has separate runtime cache sync path.
  }
  else if (changedMathPath) {
    // Math space has no main-process cache to sync; broadcast only.
  }
  else if (changedHttpPath) {
    // HTTP space has separate runtime cache sync path.
  }
  else if (changedDrawingsPath) {
    // Drawings space has no main-process cache to sync; broadcast only.
  }
  else if (forceFullSync || !changedPath) {
    hasPendingFullSync = true

    if (forceFullSync && !changedPath) {
      hasPendingNotesSync = true
      hasPendingHttpSync = true
      hasPendingDrawingsSync = true
    }
  }
  else if (changedCodeRelativePath) {
    if (!isAppEcho) {
      pendingCodeFilePaths.add(changedCodeRelativePath)
      if (pendingCodeFilePaths.size > MAX_PENDING_SYNC_FILE_PATHS) {
        hasPendingFullSync = true
      }
    }
  }
  else if (!changedNotesPath) {
    hasPendingFullSync = true
    hasPendingNotesSync = true
  }

  if (markdownWatchTimer) {
    clearTimeout(markdownWatchTimer)
    markdownWatchTimer = null
  }

  if (pendingSyncSince === null) {
    pendingSyncSince = Date.now()
  }

  const runScheduledSync = (): void => {
    markdownWatchTimer = null
    pendingSyncSince = null

    try {
      const previousCache = peekRuntimeCache()
      const previousNotesCache = peekNotesRuntimeCache()
      const previousHttpCache = peekHttpRuntimeCache()
      const changedCodeFilePaths = hasPendingFullSync
        ? null
        : [...pendingCodeFilePaths]
      const changedNoteFilePaths = hasPendingNotesSync
        ? null
        : [...pendingNoteFilePaths]
      const shouldNotifyMath = hasPendingMathSync
      const shouldNotifyDrawings = hasPendingDrawingsSync
      const shouldSyncCode
        = hasPendingFullSync
          || (changedCodeFilePaths !== null && changedCodeFilePaths.length > 0)
      const shouldSyncNotes
        = hasPendingNotesSync
          || (changedNoteFilePaths !== null && changedNoteFilePaths.length > 0)
      const shouldSyncHttp = hasPendingHttpSync

      hasPendingFullSync = false
      hasPendingMathSync = false
      hasPendingNotesSync = false
      hasPendingHttpSync = false
      hasPendingDrawingsSync = false
      pendingCodeFilePaths.clear()
      pendingNoteFilePaths.clear()

      let nextCache = previousCache
      if (shouldSyncCode) {
        nextCache
          = changedCodeFilePaths && changedCodeFilePaths.length > 0
            ? syncChangedSnippetFiles(paths, changedCodeFilePaths)
            : syncRuntimeWithDisk(paths)
      }

      let nextNotesCache = previousNotesCache
      if (shouldSyncNotes) {
        const notesPaths = getNotesPaths(vaultRootPath)
        nextNotesCache
          = changedNoteFilePaths && changedNoteFilePaths.length > 0
            ? syncChangedNoteFiles(notesPaths, changedNoteFilePaths)
            : syncNotesRuntimeWithDisk(notesPaths)
      }

      const nextHttpCache = shouldSyncHttp
        ? syncHttpRuntimeWithDisk(getHttpPaths(vaultRootPath))
        : previousHttpCache

      const hasCodeChanges
        = shouldSyncCode && (!previousCache || nextCache !== previousCache)
      const hasNotesChanges
        = shouldSyncNotes
          && (!previousNotesCache || nextNotesCache !== previousNotesCache)
      const hasMathChanges = shouldNotifyMath
      const hasDrawingsChanges = shouldNotifyDrawings
      const hasHttpChanges
        = shouldSyncHttp
          && (!previousHttpCache || nextHttpCache !== previousHttpCache)

      if (
        hasCodeChanges
        || hasNotesChanges
        || hasMathChanges
        || hasHttpChanges
        || hasDrawingsChanges
      ) {
        broadcastStorageSynced()
      }
    }
    catch (error) {
      log('storage:markdown:watcher-sync', error)
    }
  }

  // Дебаунс с верхней границей: при непрерывном потоке событий (например,
  // массовая фоновая докачка из облака даёт завершения чаще, чем раз в
  // 250 мс) чистый дебаунс откладывал бы синк и обновление UI бесконечно.
  if (Date.now() - pendingSyncSince >= MAX_PENDING_SYNC_AGE_MS) {
    runScheduledSync()
    return
  }

  markdownWatchTimer = setTimeout(runScheduledSync, 250)
}

// Самоисцеляющийся цикл: пока есть недокачанные файлы, раз в интервал
// перечитывает те записи, чьи файлы уже стали доступны (облако могло
// материализовать их без fs-события). Останавливается, когда pending нет.
function scheduleCloudRefresh(
  vaultRootPath: string,
  paths: Paths,
  notesPaths: NotesPaths,
  httpPaths: HttpPaths,
): void {
  if (cloudRefreshTimer) {
    return
  }

  cloudRefreshTimer = setTimeout(() => {
    cloudRefreshTimer = null

    let changed = false
    let remaining = 0

    try {
      const codeResult = refreshPendingSnippetFiles(paths)
      const notesResult = refreshPendingNoteFiles(notesPaths)
      changed = codeResult.changed || notesResult.changed
      remaining = codeResult.remaining + notesResult.remaining

      // HTTP не хранит pending-флаг на записях (пропущенный файл просто
      // отсутствует в state): если среди недокачанных путей есть ставший
      // доступным http-файл, пересобираем http-пространство целиком.
      // path.sep, а не '/': на Windows абсолютные пути используют '\'.
      const pendingHttpPaths = getPendingCloudPaths().filter(candidatePath =>
        candidatePath.startsWith(`${httpPaths.httpRoot}${path.sep}`),
      )
      let hasReadyHttpFile = false
      let remainingHttp = 0
      for (const candidatePath of pendingHttpPaths) {
        if (getFileAvailability(candidatePath).isCloudPlaceholder) {
          remainingHttp += 1
        }
        else {
          hasReadyHttpFile = true
        }
      }

      if (hasReadyHttpFile) {
        syncHttpRuntimeWithDisk(httpPaths)
        changed = true
      }
      remaining += remainingHttp
    }
    catch (error) {
      log('storage:markdown:cloud-refresh', error)
    }

    if (changed) {
      broadcastStorageSynced()
    }

    if (remaining > 0) {
      scheduleCloudRefresh(vaultRootPath, paths, notesPaths, httpPaths)
    }
  }, CLOUD_REFRESH_INTERVAL_MS)
}

export function stopMarkdownWatcher(): void {
  watcherStartToken += 1

  if (markdownWatchTimer) {
    clearTimeout(markdownWatchTimer)
    markdownWatchTimer = null
  }

  if (cloudRefreshTimer) {
    clearTimeout(cloudRefreshTimer)
    cloudRefreshTimer = null
  }

  pendingSyncSince = null

  if (markdownWatcher) {
    void markdownWatcher.close()
    markdownWatcher = null
  }

  watchedVaultPath = null
  pendingCodeFilePaths.clear()
  pendingNoteFilePaths.clear()
  hasPendingFullSync = false
  hasPendingMathSync = false
  hasPendingNotesSync = false
  hasPendingHttpSync = false
  hasPendingDrawingsSync = false
  resetCloudDownloads()
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
  resetPathsCache()
  resetNotesPathsCache()
}

function initializeMarkdownWatcher(vaultRootPath: string): void {
  const paths = getPaths(vaultRootPath)
  const runtimeCache = peekRuntimeCache()
  const notesPaths = getNotesPaths(vaultRootPath)
  const notesRuntimeCache = peekNotesRuntimeCache()
  const httpPaths = getHttpPaths(vaultRootPath)
  const httpRuntimeCache = peekHttpRuntimeCache()

  if (markdownWatcher && watchedVaultPath === vaultRootPath) {
    if (!runtimeCache || runtimeCache.paths.vaultPath !== paths.vaultPath) {
      ensureStateFile(paths)
      syncRuntimeWithDisk(paths)
    }

    if (
      !notesRuntimeCache
      || notesRuntimeCache.paths.notesRoot !== notesPaths.notesRoot
    ) {
      syncNotesRuntimeWithDisk(notesPaths)
    }

    if (
      !httpRuntimeCache
      || httpRuntimeCache.paths.httpRoot !== httpPaths.httpRoot
    ) {
      syncHttpRuntimeWithDisk(httpPaths)
    }

    return
  }

  stopMarkdownWatcher()

  // Обработчик регистрируется до первых сканов: они уже могут ставить
  // облачные плейсхолдеры в очередь докачки. Докачанный файл проходит через
  // общий инкрементальный sync-конвейер watcher, как внешнее изменение.
  // onQueueActivity взводит self-heal: он перепроверяет недокачанные записи
  // напрямую (stat), не полагаясь на fs-события, которых материализация
  // iCloud не порождает (mtime/size не меняются при докачке контента).
  configureCloudDownloads({
    onDownloaded: (absolutePath) => {
      const relativeWatchPath = normalizeRelativeWatchPath(
        vaultRootPath,
        absolutePath,
      )

      if (!relativeWatchPath) {
        return
      }

      scheduleStateSync(vaultRootPath, paths, relativeWatchPath)
    },
    onQueueActivity: () => {
      scheduleCloudRefresh(vaultRootPath, paths, notesPaths, httpPaths)
    },
  })

  ensureStateFile(paths)

  // Первичный скан каждого пространства падает независимо: недокачанный
  // служебный файл (state, метаданные) прерывает только свой скан, а
  // watcher всё равно запускается. Кэш заполнится после фоновой докачки
  // или первого успешного обращения через API.
  const syncSafely = (label: string, sync: () => unknown): void => {
    try {
      sync()
    }
    catch (error) {
      log(`storage:markdown:initial-sync:${label}`, error)
    }
  }

  syncSafely('code', () => syncRuntimeWithDisk(paths))
  syncSafely('notes', () => syncNotesRuntimeWithDisk(notesPaths))
  syncSafely('http', () => syncHttpRuntimeWithDisk(httpPaths))

  const startToken = ++watcherStartToken

  void getChokidarWatch()
    .then((watch) => {
      if (startToken !== watcherStartToken) {
        return
      }

      const watcher = watch(vaultRootPath, {
        awaitWriteFinish: {
          pollInterval: 100,
          stabilityThreshold: 200,
        },
        ignoreInitial: true,
        ignored: (watchPath: string) =>
          shouldIgnoreWatchPath(vaultRootPath, watchPath),
        persistent: true,
      })

      watcher
        .on('add', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
          )
        })
        .on('change', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
          )
        })
        .on('unlink', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
          )
        })
        .on('addDir', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
            true,
          )
        })
        .on('unlinkDir', (changedPath: string) => {
          scheduleStateSync(
            vaultRootPath,
            paths,
            normalizeRelativeWatchPath(vaultRootPath, changedPath),
            true,
          )
        })
        .on('error', (error: unknown) => {
          log('storage:markdown:watcher-error', error)
        })

      if (startToken !== watcherStartToken) {
        void watcher.close()
        return
      }

      markdownWatcher = watcher
      watchedVaultPath = vaultRootPath
    })
    .catch((error) => {
      if (startToken === watcherStartToken) {
        watchedVaultPath = null
      }

      log('storage:markdown:watcher-start', error)
    })
}

function configureCloudBootstrapRecovery(vaultRootPath: string): void {
  const expectedStartToken = watcherStartToken
  let isRetryScheduled = false

  const scheduleRetry = (): void => {
    if (isRetryScheduled) {
      return
    }

    isRetryScheduled = true
    setImmediate(() => {
      isRetryScheduled = false

      if (
        watcherStartToken !== expectedStartToken
        || getVaultPath() !== vaultRootPath
      ) {
        return
      }

      try {
        if (tryStartMarkdownWatcher(vaultRootPath)) {
          broadcastStorageSynced()
        }
      }
      catch (error) {
        log('storage:markdown:watcher-hydration-retry', error)
      }
    })
  }

  configureCloudDownloads({
    onDownloaded: scheduleRetry,
    onQueueActivity: () => {},
  })

  // Файл мог материализоваться между первым stat и постановкой callback.
  // Если очередь уже пуста, один отложенный retry закрывает это окно без
  // polling-loop во время обычной активной загрузки.
  if (getPendingCloudPaths().length === 0) {
    scheduleRetry()
  }
}

function tryStartMarkdownWatcher(vaultRootPath: string): boolean {
  try {
    initializeMarkdownWatcher(vaultRootPath)
    return true
  }
  catch (error) {
    if (!isCloudFileNotDownloadedError(error)) {
      throw error
    }

    // Разрешение legacy-layout может найти offloaded state до регистрации
    // обычных watcher callbacks. Сохраняем загрузку и повторяем startup,
    // когда облачный провайдер материализует файл.
    configureCloudBootstrapRecovery(vaultRootPath)
    return false
  }
}

export function startMarkdownWatcher(): void {
  tryStartMarkdownWatcher(getVaultPath())
}
