import type { UtilityProcess } from 'electron'
import type { AiSemanticStatus } from '../../../shared/aiSemantic'
import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app, utilityProcess } from 'electron'
import { AiError } from '../errors'
import {
  BUILTIN_MODEL,
  downloadModelFiles,
  downloadPercent,
  isBuiltinSupported,
  modelSnapshotDir,
} from './builtinModel'
import { formatQuery } from './text'

type WorkerMessage =
  | { type: 'ready' }
  | { type: 'error' }
  | { id: number, vectors: number[][] }
  | { id: number, error: string }
type Failure = NonNullable<AiSemanticStatus['builtin']['error']>

const IDLE_UNLOAD_MS = 5 * 60_000
// 2026-10-12: при половине ядер фоновая индексация грела CPU до 91°C. Двух потоков хватает
// эмбеддингу запроса (p50 около 33 мс), индексация vault просто идёт дольше.
const BUILTIN_THREADS = 2
const TEST_TIMEOUT_MS = 120_000

let worker:
  | {
    child: UtilityProcess
    stopping: boolean
    exited: Promise<void>
    started: Promise<void>
    settleStart: (failed?: boolean) => void
  }
  | undefined
const pending = new Map<
  number,
  { resolve: (vectors: number[][]) => void, reject: (error: Error) => void }
>()
let nextId = 0
let idleTimer: NodeJS.Timeout | undefined
let download:
  | {
    loaded: Map<string, number>
    cancelled: boolean
    controller: AbortController
    finished: Promise<void>
  }
  | undefined
let failure: Failure | undefined
let ready: boolean | undefined
let failureListener: (() => void) | undefined

function modelDir() {
  return path.join(
    app.getPath('userData'),
    'v2',
    'ai-semantic',
    'models',
    `embeddinggemma-2-${BUILTIN_MODEL.dtype}`,
  )
}

function markerPath() {
  return path.join(modelDir(), 'ready.json')
}

export function isBuiltinReady() {
  if (ready === undefined) {
    try {
      const marker = JSON.parse(readFileSync(markerPath(), 'utf8'))
      ready
        = marker.id === BUILTIN_MODEL.id
          && marker.revision === BUILTIN_MODEL.revision
          && marker.dtype === BUILTIN_MODEL.dtype
    }
    catch {
      ready = false
    }
  }
  return ready
}

export function builtinStatus(): AiSemanticStatus['builtin'] {
  const supported = isBuiltinSupported()
  if (download) {
    return {
      supported,
      state: 'downloading',
      progress: downloadPercent(download.loaded),
    }
  }
  if (failure)
    return { supported, state: 'error', error: failure }
  return { supported, state: isBuiltinReady() ? 'ready' : 'absent' }
}

// Сбой runtime вне индексации иначе не дошёл бы до индикатора: обратный импорт vectorIndex дал бы цикл.
export function onBuiltinFailure(listener: () => void) {
  failureListener = listener
}

function failRuntime() {
  failure = 'runtime'
  failureListener?.()
}

// Упавший runtime остаётся в ошибке, пока пользователь не перенастроит поиск или не скачает модель заново.
export function resetBuiltinFailure() {
  if (!download)
    failure = undefined
}

function startWorker() {
  const child = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], {
    serviceName: 'massCode Embeddings',
  })
  let settleStart!: (failed?: boolean) => void
  const started = new Promise<void>((resolve, reject) => {
    settleStart = failed =>
      failed ? reject(new Error('runtime')) : resolve()
  })
  // Вызывающий ждёт `started`; ранний краш не должен стать unhandled rejection.
  started.catch(() => {})
  const current = {
    child,
    stopping: false,
    exited: new Promise<void>(resolve => child.once('exit', () => resolve())),
    started,
    settleStart,
  }
  worker = current
  child.on('message', (message: WorkerMessage) => {
    if ('id' in message) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if ('vectors' in message)
        request?.resolve(message.vectors)
      else request?.reject(new AiError('modelUnavailable', message.error))
    }
    else {
      current.settleStart(message.type === 'error')
    }
  })
  child.once('exit', () => {
    if (worker === current)
      worker = undefined
    current.settleStart(true)
    if (current.stopping)
      return
    failRuntime()
    for (const request of pending.values())
      request.reject(new AiError('modelUnavailable'))
    pending.clear()
  })
  child.once('spawn', () =>
    child.postMessage({
      type: 'load',
      modelDir: modelDir(),
      threads: BUILTIN_THREADS,
    }))
  return current
}

async function stopWorker() {
  clearTimeout(idleTimer)
  const current = worker
  if (!current)
    return
  current.stopping = true
  current.child.kill()
  await current.exited
  for (const request of pending.values())
    request.reject(new AiError('modelUnavailable'))
  pending.clear()
}

async function embedLoaded(texts: string[], signal: AbortSignal) {
  // Останавливаемый процесс нельзя переиспользовать: дожидаемся выхода и поднимаем новый.
  while (worker?.stopping) await worker.exited
  // Конкурентные вызовы после await видят уже запущенный процесс и делят его.
  const current = worker ?? startWorker()
  try {
    await current.started
  }
  catch {
    if (!current.stopping) {
      failRuntime()
      await stopWorker()
    }
    throw new AiError('modelUnavailable')
  }
  if (signal.aborted)
    throw new AiError('timeout')
  const id = ++nextId
  try {
    return await new Promise<number[][]>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      signal.addEventListener(
        'abort',
        () => {
          pending.delete(id)
          reject(new AiError('timeout'))
        },
        { once: true },
      )
      current.child.postMessage({ id, type: 'embed', texts })
    })
  }
  finally {
    clearTimeout(idleTimer)
    if (worker === current) {
      idleTimer = setTimeout(() => {
        if (!pending.size)
          void stopWorker()
      }, IDLE_UNLOAD_MS)
    }
  }
}

export async function embedBuiltin(texts: string[], signal: AbortSignal) {
  if (download || failure || !isBuiltinReady())
    throw new AiError('modelUnavailable')
  return embedLoaded(texts, signal)
}

export async function downloadBuiltinModel(onProgress?: () => void) {
  if (download || !isBuiltinSupported())
    return false
  let finish!: () => void
  const run = {
    loaded: new Map<string, number>(),
    cancelled: false,
    controller: new AbortController(),
    finished: new Promise<void>((resolve) => {
      finish = resolve
    }),
  }
  download = run
  failure = undefined
  let stage: Failure = 'download'
  try {
    await stopWorker()
    ready = false
    await fs.rm(markerPath(), { force: true })
    // Ни один файл не попадает в worker, пока не совпали размер и хэш всех закреплённых файлов.
    await downloadModelFiles(modelSnapshotDir(modelDir()), {
      signal: run.controller.signal,
      onProgress: (file, loaded) => {
        run.loaded.set(file, loaded)
        onProgress?.()
      },
    })
    if (run.cancelled)
      return false
    stage = 'runtime'
    const [vector] = await embedLoaded(
      [formatQuery('test')],
      AbortSignal.timeout(TEST_TIMEOUT_MS),
    )
    if (run.cancelled)
      return false
    if (vector?.length !== BUILTIN_MODEL.dims)
      throw new Error('Unexpected embedding size')
    await fs.writeFile(
      markerPath(),
      JSON.stringify({
        id: BUILTIN_MODEL.id,
        revision: BUILTIN_MODEL.revision,
        dtype: BUILTIN_MODEL.dtype,
      }),
    )
    if (run.cancelled) {
      await fs.rm(markerPath(), { force: true })
      return false
    }
    ready = true
    return true
  }
  catch {
    if (run.cancelled)
      return false
    await stopWorker()
    failure = stage
    // Проверенные файлы переживают сбой runtime, и повтор после исправления системы не качает их заново.
    if (failure === 'download')
      await fs.rm(modelDir(), { recursive: true, force: true })
    return false
  }
  finally {
    if (download === run)
      download = undefined
    finish()
  }
}

async function abortDownload() {
  const run = download
  if (!run)
    return
  run.cancelled = true
  download = undefined
  run.controller.abort()
  await stopWorker()
  // Удалять каталог можно только после того, как загрузка закрыла свои файлы.
  await run.finished
}

export async function cancelBuiltinDownload() {
  if (!download)
    return
  await abortDownload()
  await fs.rm(modelDir(), { recursive: true, force: true })
}

export async function removeBuiltinModel() {
  await abortDownload()
  failure = undefined
  ready = false
  await stopWorker()
  await fs.rm(modelDir(), { recursive: true, force: true })
}

export function stopBuiltinModel() {
  clearTimeout(idleTimer)
  if (worker) {
    worker.stopping = true
    worker.child.kill()
  }
}
