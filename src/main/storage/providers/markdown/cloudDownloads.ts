import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { BrowserWindow } from 'electron'
import { log } from '../../../utils'
import { getFileAvailability } from './runtime/shared/cloudFiles'

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
// поллингом stat: у докачанного файла появляются блоки на диске.

const MAX_CONCURRENT_DOWNLOADS = 3
const MAX_DOWNLOAD_ATTEMPTS = 3
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000
const HYDRATION_POLL_INTERVAL_MS = 500
const RETRY_DELAY_MS = 5_000

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

interface ActiveDownload {
  pollTimer: NodeJS.Timeout
  readerChild: ChildProcess | null
  timeoutTimer: NodeJS.Timeout
}

type CloudFileDownloadedHandler = (absolutePath: string) => void

let onFileDownloaded: CloudFileDownloadedHandler | null = null
let queue: { absolutePath: string, attempts: number }[] = []
const queuedPaths = new Set<string>()
const activeDownloads = new Map<string, ActiveDownload>()
const retryTimers = new Set<NodeJS.Timeout>()
const failedPaths = new Set<string>()
let downloadedCount = 0

export function getCloudDownloadStatus(): CloudDownloadStatus {
  return {
    downloaded: downloadedCount,
    downloading: activeDownloads.size,
    failed: failedPaths.size,
    queued: queue.length,
  }
}

function broadcastStatus(): void {
  const status = getCloudDownloadStatus()

  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('system:cloud-download-progress', status)
  })
}

export function configureCloudDownloads(
  handler: CloudFileDownloadedHandler,
): void {
  onFileDownloaded = handler
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
  failedPaths.clear()
  downloadedCount = 0
  onFileDownloaded = null
}

export function enqueueCloudDownload(absolutePath: string): void {
  if (queuedPaths.has(absolutePath) || activeDownloads.has(absolutePath)) {
    return
  }

  // Файл, чья докачка ранее не удалась, не переполняет очередь ретраями
  // сам по себе: повторная попытка происходит только по явному действию
  // (prioritizeCloudDownload) или после перезапуска синка.
  if (failedPaths.has(absolutePath)) {
    return
  }

  queuedPaths.add(absolutePath)
  queue.push({ absolutePath, attempts: 0 })
  broadcastStatus()
  processQueue()
}

export function prioritizeCloudDownload(absolutePath: string): void {
  if (activeDownloads.has(absolutePath)) {
    return
  }

  failedPaths.delete(absolutePath)

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

function spawnHydrationTrigger(absolutePath: string): ChildProcess | null {
  try {
    if (isICloudPath(absolutePath)) {
      // brctl просит демон CloudDocs докачать файл и сразу выходит:
      // ни один процесс не блокируется, готовность увидит поллинг stat.
      return spawn('/usr/bin/brctl', ['download', absolutePath], {
        stdio: 'ignore',
      })
    }

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

function stopActiveDownload(download: ActiveDownload): void {
  clearInterval(download.pollTimer)
  clearTimeout(download.timeoutTimer)

  if (download.readerChild && download.readerChild.exitCode === null) {
    download.readerChild.kill()
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
    failedPaths.delete(absolutePath)

    try {
      onFileDownloaded?.(absolutePath)
    }
    catch (error) {
      log('storage:cloud-downloads:synced', error)
    }
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
    failedPaths.add(absolutePath)
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

function startDownload(absolutePath: string, attempts: number): void {
  const readerChild = spawnHydrationTrigger(absolutePath)

  const pollTimer = setInterval(() => {
    const availability = getFileAvailability(absolutePath)

    if (!availability.exists) {
      // Файл исчез (удалён или перемещён): докачивать больше нечего.
      finishDownload(absolutePath, false)
      return
    }

    if (!availability.isCloudPlaceholder) {
      finishDownload(absolutePath, true)
    }
  }, HYDRATION_POLL_INTERVAL_MS)

  const timeoutTimer = setTimeout(() => {
    retryOrFail(absolutePath, attempts + 1)
  }, DOWNLOAD_TIMEOUT_MS)

  activeDownloads.set(absolutePath, { pollTimer, readerChild, timeoutTimer })

  readerChild?.on('error', (error) => {
    log('storage:cloud-downloads:reader', error)
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

    // Файл мог быть докачан провайдером самостоятельно, пока стоял в
    // очереди: тогда достаточно инкрементального синка без загрузки.
    if (!availability.exists) {
      continue
    }

    if (!availability.isCloudPlaceholder) {
      downloadedCount += 1

      try {
        onFileDownloaded?.(entry.absolutePath)
      }
      catch (error) {
        log('storage:cloud-downloads:synced', error)
      }

      continue
    }

    startDownload(entry.absolutePath, entry.attempts)
  }

  broadcastStatus()
}
