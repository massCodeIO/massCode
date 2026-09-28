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

function revision(value: unknown): string {
  return value === undefined
    ? 'missing'
    : createHash('sha256').update(YAML.dump(value)).digest('hex')
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
    return classify(frontmatter.runtime)
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
  const before = readRequestRuntime(httpRoot, request)
  if (before.runtimeState !== 'ready')
    throw new Error('RUNTIME_UNAVAILABLE:HTTP runtime is unavailable')
  if (before.runtimeRevision !== expectedRevision)
    throw new Error('RUNTIME_CONFLICT:HTTP runtime changed on disk')
  writeInlineRuntime(httpRoot, request, source, runtime)
  return revision(runtime)
}
