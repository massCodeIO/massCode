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

export function requestRuntimePath(
  httpRoot: string,
  request: Pick<HttpRequestRecord, 'id' | 'createdAt'>,
): string {
  return path.join(
    httpRoot,
    `.runtime-${request.id}-${request.createdAt}.yaml`,
  )
}

function revision(source: string | null): string {
  return source === null
    ? 'missing'
    : createHash('sha256').update(source).digest('hex')
}

export function readRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
): HttpRuntimeRead {
  try {
    const source = readVaultTextFileSync(requestRuntimePath(httpRoot, request))
    const value: unknown = YAML.load(source)
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
          runtimeRevision: revision(source),
        }
      : { runtime: null, runtimeState: 'invalid', runtimeRevision: null }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        runtime: emptyHttpRuntime(),
        runtimeState: 'ready',
        runtimeRevision: 'missing',
      }
    }
    return {
      runtime: null,
      runtimeState: isCloudFileNotDownloadedError(error)
        ? 'pending'
        : 'invalid',
      runtimeRevision: null,
    }
  }
}

export function writeRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
  runtime: HttpRuntime,
  expectedRevision: string,
): string {
  if (!isHttpRuntime(runtime))
    throw new Error('INVALID_RUNTIME:Invalid HTTP runtime rules')
  assertEntityFileWritable(path.join(httpRoot, request.filePath), request)
  const target = requestRuntimePath(httpRoot, request)
  assertEntityFileWritable(target, null)
  const before = readRequestRuntime(httpRoot, request)
  if (before.runtimeState !== 'ready')
    throw new Error('RUNTIME_UNAVAILABLE:HTTP runtime is unavailable')
  const previous = fs.existsSync(target) ? readVaultTextFileSync(target) : null
  if (revision(previous) !== expectedRevision)
    throw new Error('RUNTIME_CONFLICT:HTTP runtime changed on disk')
  const temporary = `${target}.${randomUUID()}.tmp`
  const next = YAML.dump(runtime)
  try {
    fs.writeFileSync(temporary, next, { encoding: 'utf8', flag: 'wx' })
    assertEntityFileWritable(target, null)
    const current = fs.existsSync(target)
      ? readVaultTextFileSync(target)
      : null
    if (current !== previous)
      throw new Error('RUNTIME_CONFLICT:HTTP runtime changed on disk')
    fs.renameSync(temporary, target)
    markAppWrittenFileAsLocal(target)
    return revision(next)
  }
  finally {
    if (fs.existsSync(temporary))
      fs.unlinkSync(temporary)
  }
}

export function removeRequestRuntime(
  httpRoot: string,
  request: HttpRequestRecord,
): void {
  const target = requestRuntimePath(httpRoot, request)
  try {
    fs.unlinkSync(target)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
}
