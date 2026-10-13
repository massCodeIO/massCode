import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// Закреплено за коммитом, чтобы изменённый upstream-репозиторий не подменил запускаемые веса.
export const BUILTIN_MODEL = {
  id: 'onnx-community/embeddinggemma-2-ONNX',
  revision: 'daa72c51243991dfcaf9f9137d2c573d8f7790c0',
  dtype: 'q4',
  dims: 768,
} as const

export interface BuiltinModelFile {
  path: string
  size: number
  // LFS-файлы адресуются по sha256, маленькие файлы по git blob sha1.
  hash: 'sha256' | 'git-sha1'
  digest: string
}

// Ровно те файлы, которые transformers 4.3.1 читает для текстовой q4 EmbeddingGemma 2:
// config, токенизатор (tokenizer.json + tokenizer_config.json) и ONNX-сессия с внешними данными.
export const BUILTIN_MODEL_FILES: readonly BuiltinModelFile[] = [
  {
    path: 'config.json',
    size: 5031,
    hash: 'git-sha1',
    digest: 'b267dcb270ba41f67a8d14001bf470f23a9525fb',
  },
  {
    path: 'tokenizer.json',
    size: 32170510,
    hash: 'sha256',
    digest: '4d777ef5bdc1aa36227abdfb77c3e49e7b9c892d16e1b6bda41c393504828be4',
  },
  {
    path: 'tokenizer_config.json',
    size: 1599,
    hash: 'git-sha1',
    digest: 'a9afd12fb3ca2c418fd405320ace85ad46748d03',
  },
  {
    path: 'onnx/model_q4.onnx',
    size: 490742,
    hash: 'sha256',
    digest: 'f9eeba97acddf139b8ee2ddf04bc30dceafa88de93fadf74d7644e0d61a477a9',
  },
  {
    path: 'onnx/model_q4.onnx_data',
    size: 174028800,
    hash: 'sha256',
    digest: 'c3975f2d1ab7a1878ae31a7d7a9b7804a827aff3800b60dfceafce21cac3df49',
  },
]

const TOTAL_SIZE = BUILTIN_MODEL_FILES.reduce(
  (sum, file) => sum + file.size,
  0,
)
const MAX_REDIRECTS = 5

// onnxruntime-node не поставляет бинарник для darwin/x64.
export function isBuiltinSupported(
  platform: string = process.platform,
  arch: string = process.arch,
) {
  return platform !== 'darwin' || arch === 'arm64'
}

// Worker грузит модель по этому пути, поэтому файлы лежат здесь с относительными путями репозитория.
export function modelSnapshotDir(modelDir: string) {
  return path.join(
    modelDir,
    ...BUILTIN_MODEL.id.split('/'),
    BUILTIN_MODEL.revision,
  )
}

function createDigest(file: BuiltinModelFile) {
  // git хэширует заголовок с размером, поэтому берётся закреплённый размер: при другом размере файл всё равно отклоняется.
  return file.hash === 'sha256'
    ? createHash('sha256')
    : createHash('sha1').update(`blob ${file.size}\0`)
}

async function isValidFile(filePath: string, file: BuiltinModelFile) {
  try {
    if ((await fs.stat(filePath)).size !== file.size)
      return false
    const digest = createDigest(file)
    await pipeline(createReadStream(filePath), digest)
    return digest.digest('hex') === file.digest
  }
  catch {
    return false
  }
}

// Hugging Face отдаёт 307 на относительный /api/resolve-cache и 302 на CDN с xet-хранилищем;
// редиректы разбираются вручную, чтобы ни один переход не ушёл с https.
async function fetchHttps(
  url: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
) {
  let current = new URL(url)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'https:')
      throw new Error(`Refusing non-https URL: ${current.origin}`)
    const response = await fetchImpl(current, { redirect: 'manual', signal })
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location)
      return response
    await response.body?.cancel()
    current = new URL(location, current)
  }
  throw new Error('Too many redirects')
}

export async function downloadModelFile(
  file: BuiltinModelFile,
  snapshotDir: string,
  options: {
    signal: AbortSignal
    onProgress: (loaded: number) => void
    fetch?: typeof fetch
  },
) {
  const target = path.join(snapshotDir, ...file.path.split('/'))
  if (await isValidFile(target, file)) {
    options.onProgress(file.size)
    return
  }
  await fs.mkdir(path.dirname(target), { recursive: true })
  const response = await fetchHttps(
    `https://huggingface.co/${BUILTIN_MODEL.id}/resolve/${BUILTIN_MODEL.revision}/${file.path}`,
    options.signal,
    options.fetch ?? fetch,
  )
  if (!response.ok || !response.body)
    throw new Error(`Unexpected response ${response.status} for ${file.path}`)
  const digest = createDigest(file)
  let loaded = 0
  const meter = new Transform({
    transform(chunk: Uint8Array, _encoding, callback) {
      loaded += chunk.length
      if (loaded > file.size) {
        callback(new Error(`${file.path} is larger than pinned`))
        return
      }
      digest.update(chunk)
      options.onProgress(loaded)
      callback(null, chunk)
    },
  })
  const temporary = `${target}.tmp`
  await pipeline(
    Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
    meter,
    createWriteStream(temporary),
    { signal: options.signal },
  )
  if (loaded !== file.size || digest.digest('hex') !== file.digest)
    throw new Error(`${file.path} does not match the pinned hash`)
  await fs.rename(temporary, target)
}

export async function downloadModelFiles(
  snapshotDir: string,
  options: {
    signal: AbortSignal
    onProgress: (file: string, loaded: number) => void
    fetch?: typeof fetch
  },
) {
  for (const file of BUILTIN_MODEL_FILES) {
    await downloadModelFile(file, snapshotDir, {
      signal: options.signal,
      fetch: options.fetch,
      onProgress: loaded => options.onProgress(file.path, loaded),
    })
  }
}

export function downloadPercent(loaded: ReadonlyMap<string, number>) {
  let sum = 0
  for (const file of BUILTIN_MODEL_FILES)
    sum += Math.min(loaded.get(file.path) ?? 0, file.size)
  return Math.floor((sum / TOTAL_SIZE) * 100)
}
