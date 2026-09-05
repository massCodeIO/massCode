import type { HttpImportFile } from './types'
import { Buffer } from 'node:buffer'

export const importFileLimit = 2 * 1024 * 1024
export const importTotalLimit = 16 * 1024 * 1024
export const importCountLimit = 1000

export function validateImportFiles(files: HttpImportFile[]) {
  let total = 0
  if (files.length > importCountLimit)
    throw new Error('spaces.http.import.runtimeWarnings.fileLimit')
  for (const file of files) {
    const limit = file.name.toLowerCase().endsWith('.zip')
      ? importTotalLimit
      : importFileLimit
    const size = Buffer.byteLength(file.content)
    total += size
    if (size > limit || total > importTotalLimit)
      throw new Error('spaces.http.import.runtimeWarnings.fileLimit')
  }
}

/** Reject cycles, alias expansion and excessive nesting before walking YAML/JSON. */
export function validateImportTree(value: unknown) {
  const stack = [{ value, depth: 0 }]
  const seen = new Set<object>()
  let count = 0
  while (stack.length) {
    const entry = stack.pop()!
    if (++count > 100_000 || entry.depth > 64)
      throw new Error('limit')
    if (!entry.value || typeof entry.value !== 'object')
      continue
    if (seen.has(entry.value))
      throw new Error('alias')
    seen.add(entry.value)
    for (const child of Object.values(entry.value))
      stack.push({ value: child, depth: entry.depth + 1 })
  }
}
