import type {
  HttpFolderRecord,
  HttpPaths,
  HttpRequestRecord,
  HttpRuntimeCache,
  HttpState,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { toPosixPath } from '../../runtime/shared/path'
import { HTTP_STATE_FILE_NAME, httpRuntimeRef } from './constants'
import {
  parseRequestFile,
  serializeRequestFile,
  writeRequestFile,
} from './parser'
import { ensureHttpStateFile, loadHttpState, saveHttpState } from './state'

const SKIP_FILES = new Set([HTTP_STATE_FILE_NAME])

interface DiskWalkResult {
  folderRelativePaths: string[]
  requestRelativePaths: string[]
}

function walkHttpDir(rootPath: string, currentPath = rootPath): DiskWalkResult {
  const result: DiskWalkResult = {
    folderRelativePaths: [],
    requestRelativePaths: [],
  }

  if (!fs.pathExistsSync(currentPath)) {
    return result
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }

    const absolutePath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))
      result.folderRelativePaths.push(relativePath)
      const nested = walkHttpDir(rootPath, absolutePath)
      result.folderRelativePaths.push(...nested.folderRelativePaths)
      result.requestRelativePaths.push(...nested.requestRelativePaths)
      continue
    }

    if (
      entry.isFile()
      && entry.name.endsWith('.md')
      && !SKIP_FILES.has(entry.name)
    ) {
      const relativePath = toPosixPath(path.relative(rootPath, absolutePath))
      result.requestRelativePaths.push(relativePath)
    }
  }

  return result
}

function reconcileFolders(
  state: HttpState,
  folderRelativePaths: string[],
): Map<string, number> {
  const existingByPath = new Map<string, HttpFolderRecord>()
  const existingPathById = new Map<number, string>()

  // Build current path → folder map from existing state
  function buildPath(
    folder: HttpFolderRecord,
    lookup: Map<number, HttpFolderRecord>,
  ): string {
    const segments: string[] = []
    let current: HttpFolderRecord | undefined = folder
    while (current) {
      segments.unshift(current.name)
      current
        = current.parentId !== null ? lookup.get(current.parentId) : undefined
    }
    return segments.join('/')
  }

  const folderById = new Map(
    state.folders.map(folder => [folder.id, folder]),
  )
  for (const folder of state.folders) {
    const fullPath = buildPath(folder, folderById)
    existingByPath.set(fullPath, folder)
    existingPathById.set(folder.id, fullPath)
  }

  const now = Date.now()
  const sortedDiskPaths = [...folderRelativePaths].sort(
    (a, b) => a.split('/').length - b.split('/').length,
  )

  const nextFolders: HttpFolderRecord[] = []
  const folderIdByPath = new Map<string, number>()

  for (const relativePath of sortedDiskPaths) {
    const segments = relativePath.split('/')
    const name = segments[segments.length - 1]
    const parentPath = segments.slice(0, -1).join('/')
    const parentId = parentPath
      ? (folderIdByPath.get(parentPath) ?? null)
      : null

    const existing = existingByPath.get(relativePath)
    if (existing) {
      const updated: HttpFolderRecord = {
        ...existing,
        name,
        parentId,
      }
      nextFolders.push(updated)
      folderIdByPath.set(relativePath, updated.id)
      continue
    }

    state.counters.folderId += 1
    const id = state.counters.folderId
    nextFolders.push({
      id,
      name,
      parentId,
      isOpen: 0,
      orderIndex: nextFolders.length,
      createdAt: now,
      updatedAt: now,
    })
    folderIdByPath.set(relativePath, id)
  }

  state.folders = nextFolders
  return folderIdByPath
}

function reconcileRequests(
  paths: HttpPaths,
  state: HttpState,
  requestRelativePaths: string[],
  folderIdByPath: Map<string, number>,
): HttpRequestRecord[] {
  const existingByPath = new Map(
    state.requests.map(item => [item.filePath, item.id]),
  )
  const usedIds = new Set<number>()
  const records: HttpRequestRecord[] = []
  const indexEntries: HttpState['requests'] = []
  const now = Date.now()

  for (const relativePath of requestRelativePaths) {
    const absolutePath = path.join(paths.httpRoot, relativePath)
    const source = fs.readFileSync(absolutePath, 'utf8')
    const parsed = parseRequestFile(source)
    const fmId = parsed.frontmatter.id

    let id = existingByPath.get(relativePath)
    let needsRewrite = !parsed.hasFrontmatter

    if (!id) {
      if (typeof fmId === 'number' && fmId > 0 && !usedIds.has(fmId)) {
        id = fmId
      }
      else {
        state.counters.requestId += 1
        id = state.counters.requestId
        needsRewrite = true
      }
    }

    if (id > state.counters.requestId) {
      state.counters.requestId = id
    }
    usedIds.add(id)

    const dirPath = path.posix.dirname(relativePath)
    const folderId
      = dirPath && dirPath !== '.' ? (folderIdByPath.get(dirPath) ?? null) : null

    const fileName = path.posix.basename(relativePath, '.md')
    const fmCreatedAt = parsed.frontmatter.createdAt
    const fmUpdatedAt = parsed.frontmatter.updatedAt

    const record: HttpRequestRecord = {
      id,
      name: parsed.frontmatter.name || fileName,
      folderId,
      method: parsed.normalized.method,
      url: parsed.normalized.url,
      headers: parsed.normalized.headers,
      query: parsed.normalized.query,
      bodyType: parsed.normalized.bodyType,
      body: parsed.normalized.body,
      formData: parsed.normalized.formData,
      auth: parsed.normalized.auth,
      description: parsed.description,
      filePath: relativePath,
      createdAt: typeof fmCreatedAt === 'number' ? fmCreatedAt : now,
      updatedAt: typeof fmUpdatedAt === 'number' ? fmUpdatedAt : now,
    }

    if (needsRewrite || serializeRequestFile(record) !== source) {
      writeRequestFile(paths.httpRoot, record)
    }

    records.push(record)
    indexEntries.push({ id, filePath: relativePath })
  }

  state.requests = indexEntries
  return records
}

function buildRuntimeCache(
  paths: HttpPaths,
  state: HttpState,
  records: HttpRequestRecord[],
): HttpRuntimeCache {
  return {
    paths,
    state,
    requestById: new Map(records.map(record => [record.id, record])),
    folderById: new Map(state.folders.map(folder => [folder.id, folder])),
  }
}

export function syncHttpRuntimeWithDisk(paths: HttpPaths): HttpRuntimeCache {
  ensureHttpStateFile(paths)
  const state = loadHttpState(paths)

  const walk = walkHttpDir(paths.httpRoot)
  const folderIdByPath = reconcileFolders(state, walk.folderRelativePaths)
  const records = reconcileRequests(
    paths,
    state,
    walk.requestRelativePaths,
    folderIdByPath,
  )

  saveHttpState(paths, state)

  const cache = buildRuntimeCache(paths, state, records)
  httpRuntimeRef.cache = cache
  return cache
}

export function getHttpRuntimeCache(paths: HttpPaths): HttpRuntimeCache {
  if (
    httpRuntimeRef.cache
    && httpRuntimeRef.cache.paths.httpRoot === paths.httpRoot
  ) {
    return httpRuntimeRef.cache
  }

  return syncHttpRuntimeWithDisk(paths)
}

export function resetHttpRuntimeCache(): void {
  httpRuntimeRef.cache = null
}
