import type {
  HttpRuntime,
  HttpRuntimeRead,
} from '../../../../../../shared/httpRuntime'
import type { HttpRequestRecord } from './types'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'fs-extra'
import YAML from 'js-yaml'
import {
  emptyHttpRuntime,
  isHttpRuntime,
} from '../../../../../../shared/httpRuntime'
import { markAppWrittenFileAsLocal } from '../../runtime/shared/cloudFiles'
import { assertEntityFileWritable } from '../../runtime/shared/cloudGuards'
import {
  isCloudFileNotDownloadedError,
  readVaultTextFileSync,
} from '../../runtime/shared/guardedRead'
import { splitFrontmatter } from './parser'

/** Legacy location, used only for migration and deletion. */
export function requestRuntimePath(
  httpRoot: string,
  request: Pick<HttpRequestRecord, 'id' | 'createdAt'>,
): string {
  return path.join(
    httpRoot,
    `.runtime-${request.id}-${request.createdAt}.yaml`,
  )
}

function revision(value: unknown): string {
  return value === undefined
    ? 'missing'
    : createHash('sha256').update(YAML.dump(value)).digest('hex')
}

function readLegacyRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
): string | null {
  try {
    return readVaultTextFileSync(requestRuntimePath(httpRoot, request))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return null
    throw error
  }
}

function classify(value: unknown): HttpRuntimeRead {
  if (value === undefined) {
    return {
      runtime: emptyHttpRuntime(),
      runtimeState: 'ready',
      runtimeRevision: 'missing',
    }
  }
  if (
    value
    && typeof value === 'object'
    && 'version' in value
    && value.version !== 1
    && value.version !== 2
  ) {
    return {
      runtime: null,
      runtimeState: 'unsupported',
      runtimeRevision: null,
    }
  }
  return isHttpRuntime(value)
    ? {
        runtime: value,
        runtimeState: 'ready',
        runtimeRevision: revision(value),
      }
    : { runtime: null, runtimeState: 'invalid', runtimeRevision: null }
}

export function readRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
): HttpRuntimeRead {
  try {
    const source = readVaultTextFileSync(path.join(httpRoot, request.filePath))
    const { frontmatter } = splitFrontmatter(source)
    if (Object.hasOwn(frontmatter, 'runtime'))
      return classify(frontmatter.runtime)
    const legacy = readLegacyRuntime(httpRoot, request)
    return legacy === null ? classify(undefined) : classify(YAML.load(legacy))
  }
  catch (error) {
    return {
      runtime: null,
      runtimeState: isCloudFileNotDownloadedError(error)
        ? 'pending'
        : 'invalid',
      runtimeRevision: null,
    }
  }
}

function writeInlineRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
  source: string,
  runtime: HttpRuntime,
): void {
  const target = path.join(httpRoot, request.filePath)
  const { frontmatter, body } = splitFrontmatter(source)
  const next = `---\n${YAML.dump({ ...frontmatter, runtime }, { lineWidth: -1, noRefs: true }).trim()}\n---\n${body}`
  const temporary = `${target}.${randomUUID()}.tmp`
  assertEntityFileWritable(target, request)
  try {
    fs.writeFileSync(temporary, next, { encoding: 'utf8', flag: 'wx' })
    assertEntityFileWritable(target, request)
    if (readVaultTextFileSync(target) !== source)
      throw new Error('RUNTIME_CONFLICT:HTTP request changed on disk')
    fs.renameSync(temporary, target)
    markAppWrittenFileAsLocal(target)
  }
  finally {
    if (fs.existsSync(temporary))
      fs.unlinkSync(temporary)
  }
}

function removeUnchangedLegacy(
  httpRoot: string,
  request: HttpRequestRecord,
  source: string,
): void {
  // A concurrent cloud edit or a cleanup failure must never undo a successful
  // Markdown write. Keep the sidecar for recovery; inline data is authoritative.
  try {
    if (readLegacyRuntime(httpRoot, request) === source)
      fs.unlinkSync(requestRuntimePath(httpRoot, request))
  }
  catch {}
}

export function migrateRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
): void {
  const legacy = readLegacyRuntime(httpRoot, request)
  if (legacy === null)
    return
  const value: unknown = YAML.load(legacy)
  if (!isHttpRuntime(value))
    return
  const source = readVaultTextFileSync(path.join(httpRoot, request.filePath))
  const { frontmatter } = splitFrontmatter(source)
  if (Object.hasOwn(frontmatter, 'runtime')) {
    // Retry cleanup after an interrupted migration, but keep divergent copies.
    if (revision(frontmatter.runtime) === revision(value))
      removeUnchangedLegacy(httpRoot, request, legacy)
    return
  }
  if (readLegacyRuntime(httpRoot, request) !== legacy)
    throw new Error('RUNTIME_CONFLICT:HTTP runtime changed on disk')
  writeInlineRuntime(httpRoot, request, source, value)
  removeUnchangedLegacy(httpRoot, request, legacy)
}

export function writeRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
  runtime: HttpRuntime,
  expectedRevision: string,
): string {
  if (!isHttpRuntime(runtime))
    throw new Error('INVALID_RUNTIME:Invalid HTTP runtime rules')
  const target = path.join(httpRoot, request.filePath)
  assertEntityFileWritable(target, request)
  const source = readVaultTextFileSync(target)
  const { frontmatter } = splitFrontmatter(source)
  const legacy = Object.hasOwn(frontmatter, 'runtime')
    ? null
    : readLegacyRuntime(httpRoot, request)
  const before = readRequestRuntime(httpRoot, request)
  if (before.runtimeState !== 'ready')
    throw new Error('RUNTIME_UNAVAILABLE:HTTP runtime is unavailable')
  if (before.runtimeRevision !== expectedRevision)
    throw new Error('RUNTIME_CONFLICT:HTTP runtime changed on disk')
  if (legacy !== null && readLegacyRuntime(httpRoot, request) !== legacy)
    throw new Error('RUNTIME_CONFLICT:HTTP runtime changed on disk')
  writeInlineRuntime(httpRoot, request, source, runtime)
  if (legacy !== null)
    removeUnchangedLegacy(httpRoot, request, legacy)
  return revision(runtime)
}

export function removeRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
): void {
  try {
    fs.unlinkSync(requestRuntimePath(httpRoot, request))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
}
