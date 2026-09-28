import type { ChildProcess } from 'node:child_process'
import type { Stats } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { BrowserWindow } from 'electron'
import fs from 'fs-extra'
import { log } from '../../../utils'
import {
  getFileAvailability,
  markFileReadableDespiteZeroBlocks,
  resetCloudFileExemptions,
} from './runtime/shared/cloudFiles'

// Фоновая докачка облачных плейсхолдеров (iCloud Drive, Dropbox, OneDrive,
// Google Drive). Главный принцип: main process никогда не читает
// недокачанный файл синхронно. Вместо этого файл попадает в очередь,
// материализация выполняется вне event loop, а по завершении вызывается
// инкрементальный sync через зарегистрированный обработчик.
//
// Механика материализации: для iCloud скачивание запускается через
// `brctl download` (без блокировки процессов), для остальных провайдеров
// содержимое вычитывает отдельный child process (чтение данных заставляет
// провайдера докачать файл; зависший child убивается по таймауту, что
// невозможно для потоков внутри main process). Факт готовности определяется
// либо успешным выходом child-ридера (файл дочитан до конца), либо
// поллингом stat: у докачанного файла появляются блоки на диске, причём
// сигнатура должна быть стабильной в двух опросах подряд, чтобы не принять
// частично скачанный файл за готовый.

const MAX_CONCURRENT_DOWNLOADS = 3
const MAX_DOWNLOAD_ATTEMPTS = 3
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000
const HYDRATION_POLL_INTERVAL_MS = 500
const RETRY_DELAY_MS = 5_000
// Файл из failedPaths снова допускается в очередь после паузы: сеть могла
// восстановиться, а вечная блокировка потребовала бы перезапуска приложения.
const FAILED_RETRY_COOLDOWN_MS = 10 * 60_000
// Файл, который очередь раз за разом признаёт «уже локальным», но который
// после этого снова попадает в очередь, читается с ошибкой не из-за облака
// (EACCES, EIO): без предела это бесконечный цикл sync -> enqueue.
const MAX_IMMEDIATE_COMPLETIONS = 3

// Читает файл потоково и выходит: сам факт чтения заставляет облачного
// провайдера материализовать содержимое. Запускается как ELECTRON_RUN_AS_NODE.
const HYDRATION_READER_SCRIPT = [
  'const fs = require(\'node:fs\')',
  'const stream = fs.createReadStream(process.env.MASSCODE_HYDRATE_PATH)',
  'stream.on(\'data\', () => {})',
  'stream.on(\'end\', () => process.exit(0))',
  'stream.on(\'error\', () => process.exit(1))',
].join('\n')

export interface CloudDownloadStatus {
  downloaded: number
  downloading: number
  failed: number
  queued: number
}

interface StableProbe {
  blocks: number
  mtimeMs: number
  size: number
}

interface ActiveDownload {
  pollTimer: NodeJS.Timeout
  previousProbe: StableProbe | null
  readerChild: ChildProcess | null
  timeoutTimer: NodeJS.Timeout
}

type CloudFileDownloadedHandler = (absolutePath: string) => void

let onFileDownloaded: CloudFileDownloadedHandler | null = null
let onQueueActivity: (() => void) | null = null
let queue: { absolutePath: string, attempts: number }[] = []
const queuedPaths = new Set<string>()
const activeDownloads = new Map<string, ActiveDownload>()
const retryTimers = new Set<NodeJS.Timeout>()
const failedAtByPath = new Map<string, number>()
const immediateCompletionsByPath = new Map<string, number>()
let downloadedCount = 0

export function getCloudDownloadStatus(): CloudDownloadStatus {
  return {
    downloaded: downloadedCount,
    downloading: activeDownloads.size,
    failed: failedAtByPath.size,
    queued: queue.length,
  }
}

function broadcastStatus(): void {
  const status = getCloudDownloadStatus()

  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('system:cloud-download-progress', status)
  })
}

export function configureCloudDownloads(options: {
  onDownloaded: CloudFileDownloadedHandler
  onQueueActivity: () => void
}): void {
  onFileDownloaded = options.onDownloaded
  onQueueActivity = options.onQueueActivity
}

// Все пути, докачка которых ещё не завершена (в очереди, активные или
// отложенные после неудачи). Self-heal перепроверяет их напрямую, не
// полагаясь на fs-события, которых материализация iCloud не порождает.
export function getPendingCloudPaths(): string[] {
  return [...queuedPaths, ...activeDownloads.keys(), ...failedAtByPath.keys()]
}

export function resetCloudDownloads(): void {
  for (const [, download] of activeDownloads) {
    stopActiveDownload(download)
  }

  for (const timer of retryTimers) {
    clearTimeout(timer)
  }

  activeDownloads.clear()
  retryTimers.clear()
  queue = []
  queuedPaths.clear()
  failedAtByPath.clear()
  immediateCompletionsByPath.clear()
  downloadedCount = 0
  onFileDownloaded = null
  onQueueActivity = null
  resetCloudFileExemptions()
  broadcastStatus()
}

export function enqueueCloudDownload(absolutePath: string): void {
  if (queuedPaths.has(absolutePath) || activeDownloads.has(absolutePath)) {
    return
  }

  const failedAt = failedAtByPath.get(absolutePath)
  if (failedAt !== undefined) {
    if (Date.now() - failedAt < FAILED_RETRY_COOLDOWN_MS) {
      return
    }

    failedAtByPath.delete(absolutePath)
    immediateCompletionsByPath.delete(absolutePath)
  }

  queuedPaths.add(absolutePath)
  queue.push({ absolutePath, attempts: 0 })
  onQueueActivity?.()
  broadcastStatus()
  processQueue()
}

export function prioritizeCloudDownload(absolutePath: string): void {
  if (activeDownloads.has(absolutePath)) {
    return
  }

  // Явное действие пользователя всегда даёт файлу новый шанс.
  failedAtByPath.delete(absolutePath)
  immediateCompletionsByPath.delete(absolutePath)

  const queueIndex = queue.findIndex(
    entry => entry.absolutePath === absolutePath,
  )

  if (queueIndex === -1) {
    queuedPaths.add(absolutePath)
    queue.unshift({ absolutePath, attempts: 0 })
  }
  else if (queueIndex > 0) {
    const [entry] = queue.splice(queueIndex, 1)
    queue.unshift(entry)
  }

  broadcastStatus()
  processQueue()
}

function isICloudPath(absolutePath: string): boolean {
  return (
    process.platform === 'darwin'
    && absolutePath.includes('/Library/Mobile Documents/')
  )
}

function spawnHydrationReader(absolutePath: string): ChildProcess | null {
  try {
    return spawn(process.execPath, ['-e', HYDRATION_READER_SCRIPT], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        MASSCODE_HYDRATE_PATH: absolutePath,
      },
      stdio: 'ignore',
    })
  }
  catch (error) {
    log('storage:cloud-downloads:spawn', error)
    return null
  }
}

function spawnBrctlDownload(absolutePath: string): void {
  try {
    // brctl просит демон CloudDocs докачать файл и сразу выходит: его код
    // выхода означает лишь принятие запроса, готовность определяет поллинг.
    const child = spawn('/usr/bin/brctl', ['download', absolutePath], {
      stdio: 'ignore',
    })
    child.on('error', (error) => {
      log('storage:cloud-downloads:brctl', error)
    })
  }
  catch (error) {
    log('storage:cloud-downloads:brctl', error)
  }
}

function stopActiveDownload(download: ActiveDownload): void {
  clearInterval(download.pollTimer)
  clearTimeout(download.timeoutTimer)

  if (download.readerChild && download.readerChild.exitCode === null) {
    download.readerChild.kill()
  }
}

function notifyFileDownloaded(absolutePath: string): void {
  try {
    onFileDownloaded?.(absolutePath)
  }
  catch (error) {
    log('storage:cloud-downloads:synced', error)
  }
}

function finishDownload(absolutePath: string, succeeded: boolean): void {
  const download = activeDownloads.get(absolutePath)
  if (!download) {
    return
  }

  stopActiveDownload(download)
  activeDownloads.delete(absolutePath)

  if (succeeded) {
    downloadedCount += 1
    failedAtByPath.delete(absolutePath)
    immediateCompletionsByPath.delete(absolutePath)
    notifyFileDownloaded(absolutePath)
  }

  broadcastStatus()
  processQueue()
}

function retryOrFail(absolutePath: string, attempts: number): void {
  const download = activeDownloads.get(absolutePath)
  if (!download) {
    return
  }

  stopActiveDownload(download)
  activeDownloads.delete(absolutePath)

  if (attempts >= MAX_DOWNLOAD_ATTEMPTS) {
    failedAtByPath.set(absolutePath, Date.now())
    log(
      'storage:cloud-downloads:failed',
      `Giving up on cloud download after ${attempts} attempts: ${absolutePath}`,
    )
    broadcastStatus()
    processQueue()
    return
  }

  const retryTimer = setTimeout(() => {
    retryTimers.delete(retryTimer)

    if (!queuedPaths.has(absolutePath) && !activeDownloads.has(absolutePath)) {
      queuedPaths.add(absolutePath)
      queue.push({ absolutePath, attempts })
      broadcastStatus()
      processQueue()
    }
  }, RETRY_DELAY_MS * attempts)

  retryTimers.add(retryTimer)
  broadcastStatus()
  processQueue()
}

function toStableProbe(stats: Stats): StableProbe {
  return {
    blocks: stats.blocks,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  }
}

function isSameProbe(a: StableProbe | null, b: StableProbe): boolean {
  return (
    a !== null
    && a.blocks === b.blocks
    && a.mtimeMs === b.mtimeMs
    && a.size === b.size
  )
}

function startDownload(absolutePath: string, attempts: number): void {
  let readerChild: ChildProcess | null = null

  // В режиме симуляции (MASSCODE_SIMULATE_CLOUD_PLACEHOLDERS) «докачку»
  // выполняет внешний скрипт удалением сайдкара: приложение только поллит
  // готовность, не запуская brctl/reader.
  if (process.env.MASSCODE_SIMULATE_CLOUD_PLACEHOLDERS === '1') {
    // Поллинг ниже определит готовность.
  }
  else if (isICloudPath(absolutePath)) {
    spawnBrctlDownload(absolutePath)
  }
  else {
    readerChild = spawnHydrationReader(absolutePath)
  }

  const pollTimer = setInterval(() => {
    const download = activeDownloads.get(absolutePath)
    if (!download) {
      return
    }

    const availability = getFileAvailability(absolutePath)

    if (!availability.exists || !availability.stats) {
      // Файл исчез (удалён или перемещён): докачивать больше нечего.
      finishDownload(absolutePath, false)
      return
    }

    const probe = toStableProbe(availability.stats)

    // Готовность объявляется только по стабильной сигнатуре в двух опросах
    // подряд: провайдеры, пишущие файл на диск постепенно, дают blocks > 0
    // задолго до конца скачивания.
    if (
      !availability.isCloudPlaceholder
      && isSameProbe(download.previousProbe, probe)
    ) {
      finishDownload(absolutePath, true)
      return
    }

    download.previousProbe = probe
  }, HYDRATION_POLL_INTERVAL_MS)

  const timeoutTimer = setTimeout(() => {
    retryOrFail(absolutePath, attempts + 1)
  }, DOWNLOAD_TIMEOUT_MS)

  activeDownloads.set(absolutePath, {
    pollTimer,
    previousProbe: null,
    readerChild,
    timeoutTimer,
  })

  readerChild?.on('error', (error) => {
    log('storage:cloud-downloads:reader', error)
  })

  readerChild?.on('exit', (code) => {
    if (code !== 0 || !activeDownloads.has(absolutePath)) {
      return
    }

    // Ридер дочитал файл до конца: содержимое гарантированно локально.
    // Если stat всё ещё показывает сигнатуру плейсхолдера, это ложное
    // срабатывание эвристики (inline/resident-файл): такой файл помечается
    // читаемым, иначе он навсегда остался бы «недокачанным».
    try {
      const stats = fs.statSync(absolutePath)

      if (stats.isFile() && stats.size > 0 && stats.blocks === 0) {
        markFileReadableDespiteZeroBlocks(absolutePath, stats)
      }

      finishDownload(absolutePath, true)
    }
    catch {
      finishDownload(absolutePath, false)
    }
  })
}

function processQueue(): void {
  while (queue.length > 0 && activeDownloads.size < MAX_CONCURRENT_DOWNLOADS) {
    const entry = queue.shift()
    if (!entry) {
      return
    }

    queuedPaths.delete(entry.absolutePath)

    const availability = getFileAvailability(entry.absolutePath)

    if (!availability.exists) {
      continue
    }

    // Файл мог быть докачан провайдером самостоятельно, пока стоял в
    // очереди: тогда достаточно инкрементального синка без загрузки.
    if (!availability.isCloudPlaceholder) {
      const completions
        = (immediateCompletionsByPath.get(entry.absolutePath) ?? 0) + 1

      // Файл снова и снова признаётся «уже локальным», но продолжает
      // попадать в очередь: он читается с ошибкой не из-за облака.
      // Без предела это бесконечный цикл sync -> enqueue.
      if (completions > MAX_IMMEDIATE_COMPLETIONS) {
        failedAtByPath.set(entry.absolutePath, Date.now())
        log(
          'storage:cloud-downloads:failed',
          `File is local but repeatedly unreadable: ${entry.absolutePath}`,
        )
        continue
      }

      immediateCompletionsByPath.set(entry.absolutePath, completions)
      downloadedCount += 1
      notifyFileDownloaded(entry.absolutePath)
      continue
    }

    startDownload(entry.absolutePath, entry.attempts)
  }

  broadcastStatus()
}
