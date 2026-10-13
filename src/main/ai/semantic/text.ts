import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

// Хост и query HTTP-запросов не индексируются: в них часто лежат учётные данные.
export function httpSearchPath(url: string) {
  return url
    .replace(/^(?:https?:\/\/[^/]+|\{\{[^}]+\}\})/i, '')
    .split(/[?#]/)[0]
}

// EmbeddingGemma обучена с task-промптами, остальные модели ждут обычный текст.
function usesTaskPrompts(model: string) {
  return /embeddinggemma/i.test(model)
}

export function formatQuery(model: string, query: string) {
  return usesTaskPrompts(model)
    ? `task: search result | query: ${query}`
    : query
}

export function formatDocument(model: string, name: string, text: string) {
  return usesTaskPrompts(model)
    ? `title: ${name.trim() || 'none'} | text: ${text}`
    : [name.trim(), text].filter(Boolean).join('\n')
}

export function normalize(vector: ArrayLike<number>) {
  const result = Float32Array.from(vector)
  let norm = 0
  for (const value of result) norm += value * value
  norm = Math.sqrt(norm)
  if (!norm)
    return result.fill(0)
  for (let index = 0; index < result.length; index++) result[index] /= norm
  return result
}

export function dot(a: Float32Array, b: Float32Array) {
  let sum = 0
  for (let index = 0; index < Math.min(a.length, b.length); index++)
    sum += a[index] * b[index]
  return sum
}

export function encodeVector(vector: Float32Array) {
  return Buffer.from(
    vector.buffer,
    vector.byteOffset,
    vector.byteLength,
  ).toString('base64')
}

export function decodeVector(value: string) {
  const bytes = Buffer.from(value, 'base64')
  // Копия в новый буфер: смещение пулового Buffer в Node не выровнено по 4 байтам.
  return new Float32Array(Uint8Array.from(bytes).buffer)
}

export function textHash(text: string) {
  return createHash('sha1').update(text).digest('hex')
}
