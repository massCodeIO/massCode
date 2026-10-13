import type { BuiltinModelFile } from '../builtinModel'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BUILTIN_MODEL,
  BUILTIN_MODEL_FILES,
  downloadModelFile,
  downloadPercent,
  isBuiltinSupported,
  modelSnapshotDir,
} from '../builtinModel'

let directory: string

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-builtin-'))
})
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true })
})

// Отдаёт тело несколькими чанками, чтобы хэш и счётчик проверялись на потоке, а не на целом буфере.
function chunked(content: string, init?: ResponseInit) {
  const bytes = new TextEncoder().encode(content)
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 2)
          controller.enqueue(bytes.slice(offset, offset + 2))
        controller.close()
      },
    }),
    init,
  )
}

function download(
  file: BuiltinModelFile,
  fetchImpl: typeof fetch,
  onProgress = vi.fn(),
) {
  return downloadModelFile(file, directory, {
    signal: new AbortController().signal,
    onProgress,
    fetch: fetchImpl,
  })
}

const config: BuiltinModelFile = {
  path: 'config.json',
  size: 6,
  hash: 'git-sha1',
  // `git hash-object` для "hello\n".
  digest: 'ce013625030ba8dba906f756967f9e9ca394464a',
}
const weights: BuiltinModelFile = {
  path: 'onnx/model.onnx',
  size: 3,
  hash: 'sha256',
  digest: createHash('sha256').update('abc').digest('hex'),
}

describe('downloadModelFile', () => {
  it('streams git blob and sha256 files from the pinned revision into place', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      chunked(String(url).endsWith('config.json') ? 'hello\n' : 'abc'),
    )
    const progress = vi.fn()
    await download(config, fetchImpl, progress)
    await download(weights, fetchImpl)
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      `https://huggingface.co/${BUILTIN_MODEL.id}/resolve/${BUILTIN_MODEL.revision}/config.json`,
    )
    expect(progress).toHaveBeenLastCalledWith(6)
    expect(fs.readFileSync(path.join(directory, 'config.json'), 'utf8')).toBe(
      'hello\n',
    )
    expect(
      fs.readFileSync(path.join(directory, 'onnx', 'model.onnx'), 'utf8'),
    ).toBe('abc')
    expect(fs.existsSync(path.join(directory, 'onnx', 'model.onnx.tmp'))).toBe(
      false,
    )
  })
  it('skips a file that is already in place and valid', async () => {
    fs.mkdirSync(path.join(directory, 'onnx'))
    fs.writeFileSync(path.join(directory, 'onnx', 'model.onnx'), 'abc')
    const fetchImpl = vi.fn()
    await download(weights, fetchImpl)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('rejects a body larger than pinned before writing it in place', async () => {
    await expect(
      download(weights, async () => chunked('abcdef')),
    ).rejects.toThrow('larger than pinned')
    expect(fs.existsSync(path.join(directory, 'onnx', 'model.onnx'))).toBe(
      false,
    )
  })
  it('rejects a body with a different hash or a shorter length', async () => {
    await expect(download(weights, async () => chunked('abd'))).rejects.toThrow(
      'pinned hash',
    )
    await expect(download(weights, async () => chunked('ab'))).rejects.toThrow(
      'pinned hash',
    )
    expect(fs.existsSync(path.join(directory, 'onnx', 'model.onnx'))).toBe(
      false,
    )
  })
  it('follows https redirects and refuses a redirect to http', async () => {
    const redirects = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href.includes('/resolve/')) {
        return new Response(null, {
          status: 307,
          headers: { location: '/api/resolve-cache/x' },
        })
      }
      if (href.includes('/api/resolve-cache/')) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.test/x' },
        })
      }
      return chunked('abc')
    })
    await download(weights, redirects)
    expect(redirects.mock.calls.map(([url]) => String(url))).toEqual([
      `https://huggingface.co/${BUILTIN_MODEL.id}/resolve/${BUILTIN_MODEL.revision}/onnx/model.onnx`,
      'https://huggingface.co/api/resolve-cache/x',
      'https://cdn.example.test/x',
    ])
    fs.rmSync(path.join(directory, 'onnx'), { recursive: true })
    await expect(
      download(
        weights,
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://cdn.example.test/x' },
          }),
      ),
    ).rejects.toThrow('non-https')
  })
  it('rejects an error response', async () => {
    await expect(
      download(weights, async () => new Response('missing', { status: 404 })),
    ).rejects.toThrow('404')
  })
})

describe('built-in model', () => {
  it('is unavailable only on Intel Macs', () => {
    expect(isBuiltinSupported('darwin', 'arm64')).toBe(true)
    expect(isBuiltinSupported('darwin', 'x64')).toBe(false)
    expect(isBuiltinSupported('win32', 'x64')).toBe(true)
    expect(isBuiltinSupported('linux', 'x64')).toBe(true)
  })
  it('keeps files under a revision-specific directory', () => {
    expect(modelSnapshotDir(directory)).toBe(
      path.join(
        directory,
        'onnx-community',
        'embeddinggemma-2-ONNX',
        BUILTIN_MODEL.revision,
      ),
    )
  })
  it('reports download progress over all pinned files and ignores others', () => {
    expect(downloadPercent(new Map())).toBe(0)
    const all = new Map(
      BUILTIN_MODEL_FILES.map(file => [file.path, file.size]),
    )
    expect(downloadPercent(all)).toBe(100)
    all.set('onnx/model_q4.onnx_data', 0)
    all.set('unexpected.bin', 10 ** 9)
    expect(downloadPercent(all)).toBe(15)
  })
})
