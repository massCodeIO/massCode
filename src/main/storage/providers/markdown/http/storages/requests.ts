import type {
  HttpRequestCreateInput,
  HttpRequestsQueryInput,
  HttpRequestsStorage,
  HttpRequestUpdateInput,
  HttpRequestUpdateResult,
} from '../../../../contracts'
import type {
  HttpFolderRecord,
  HttpRequestRecord,
  HttpState,
} from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import { getVaultPath } from '../../runtime/paths'
import { buildFolderPathMap } from '../../runtime/shared/folderIndex'
import {
  assertUniqueSiblingEntryName,
  throwStorageError,
  validateEntryName,
} from '../../runtime/validation'
import { writeRequestFile } from '../runtime/parser'
import { getHttpPaths } from '../runtime/paths'
import { saveHttpState } from '../runtime/state'
import { getHttpRuntimeCache } from '../runtime/sync'

function findFolderById(
  folders: HttpFolderRecord[],
  folderId: number,
): HttpFolderRecord | undefined {
  return folders.find(folder => folder.id === folderId)
}

function resolveFolderRelativePath(
  state: HttpState,
  folderId: number | null,
): string {
  if (folderId === null) {
    return ''
  }

  const folderPathMap = buildFolderPathMap(state.folders)
  return folderPathMap.get(folderId) ?? ''
}

function buildRequestFilePath(
  state: HttpState,
  folderId: number | null,
  name: string,
): string {
  const folderPath = resolveFolderRelativePath(state, folderId)
  const fileName = `${name}.md`
  return folderPath ? path.posix.join(folderPath, fileName) : fileName
}

function removeRequestFile(httpRoot: string, filePath: string): void {
  const absolutePath = path.join(httpRoot, filePath)
  if (fs.pathExistsSync(absolutePath)) {
    fs.removeSync(absolutePath)
  }
}

function moveRequestFile(
  httpRoot: string,
  oldFilePath: string,
  newFilePath: string,
): void {
  if (oldFilePath === newFilePath) {
    return
  }

  const oldAbsolutePath = path.join(httpRoot, oldFilePath)
  if (!fs.pathExistsSync(oldAbsolutePath)) {
    return
  }

  const newAbsolutePath = path.join(httpRoot, newFilePath)
  fs.ensureDirSync(path.dirname(newAbsolutePath))
  fs.moveSync(oldAbsolutePath, newAbsolutePath, { overwrite: false })
}

function getUniqueRequestFilePath(
  httpRoot: string,
  targetPath: string,
  currentFilePath: string | null,
): string {
  const targetAbsolutePath = path.join(httpRoot, targetPath)

  if (!fs.pathExistsSync(targetAbsolutePath)) {
    return targetPath
  }

  if (currentFilePath) {
    const currentAbsolutePath = path.join(httpRoot, currentFilePath)
    if (
      targetAbsolutePath.toLowerCase() === currentAbsolutePath.toLowerCase()
    ) {
      return targetPath
    }
  }

  const dir = path.posix.dirname(targetPath)
  const ext = path.posix.extname(targetPath)
  const baseName = path.posix.basename(targetPath, ext)

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidatePath = path.posix.join(dir, `${baseName} ${suffix}${ext}`)
    const candidateAbsolutePath = path.join(httpRoot, candidatePath)

    if (!fs.pathExistsSync(candidateAbsolutePath)) {
      return candidatePath
    }
  }

  throwStorageError(
    'NAME_CONFLICT',
    'Cannot generate unique request file name',
  )
}

export function createHttpRequestsStorage(): HttpRequestsStorage {
  function resolvePaths() {
    return getHttpPaths(getVaultPath())
  }

  function getCache() {
    return getHttpRuntimeCache(resolvePaths())
  }

  return {
    getRequests(query?: HttpRequestsQueryInput) {
      const { requestById } = getCache()
      const all = [...requestById.values()].sort(
        (a, b) => b.createdAt - a.createdAt,
      )

      const search = query?.search?.trim().toLowerCase()
      if (!search) {
        return all
      }

      return all.filter(
        request =>
          request.name.toLowerCase().includes(search)
          || request.url.toLowerCase().includes(search),
      )
    },

    getRequestById(id: number) {
      const { requestById } = getCache()
      return requestById.get(id) ?? null
    },

    createRequest(input: HttpRequestCreateInput) {
      const paths = resolvePaths()
      const cache = getHttpRuntimeCache(paths)
      const { state } = cache

      const name = validateEntryName(input.name, 'request')
      const folderId = input.folderId ?? null

      if (folderId !== null && !findFolderById(state.folders, folderId)) {
        throwStorageError('FOLDER_NOT_FOUND', 'Folder not found')
      }

      const existingEntries = [...cache.requestById.values()].map(record => ({
        folderId: record.folderId,
        id: record.id,
        name: record.name,
      }))
      assertUniqueSiblingEntryName(existingEntries, folderId, name, 'request')

      state.counters.requestId += 1
      const id = state.counters.requestId
      const now = Date.now()
      const filePath = buildRequestFilePath(state, folderId, name)

      const record: HttpRequestRecord = {
        auth: { type: 'none' },
        body: null,
        bodyType: 'none',
        createdAt: now,
        description: '',
        filePath,
        folderId,
        formData: [],
        headers: [],
        id,
        method: input.method ?? 'GET',
        name,
        query: [],
        updatedAt: now,
        url: input.url ?? '',
      }

      writeRequestFile(paths.httpRoot, record)
      state.requests.push({ filePath, id })
      cache.requestById.set(id, record)

      saveHttpState(paths, state)

      return { id }
    },

    updateRequest(
      id: number,
      input: HttpRequestUpdateInput,
    ): HttpRequestUpdateResult {
      const paths = resolvePaths()
      const cache = getHttpRuntimeCache(paths)
      const { state } = cache
      const record = cache.requestById.get(id)

      if (!record) {
        return { invalidInput: false, notFound: true }
      }

      const updatableFields = [
        input.name,
        input.folderId,
        input.method,
        input.url,
        input.headers,
        input.query,
        input.bodyType,
        input.body,
        input.formData,
        input.auth,
        input.description,
      ]

      if (updatableFields.every(value => value === undefined)) {
        return { invalidInput: true, notFound: false }
      }

      const previousFilePath = record.filePath
      const previousName = record.name
      const previousFolderId = record.folderId

      const nextFolderId
        = input.folderId !== undefined
          ? (input.folderId ?? null)
          : record.folderId
      if (
        nextFolderId !== null
        && nextFolderId !== record.folderId
        && !findFolderById(state.folders, nextFolderId)
      ) {
        throwStorageError('FOLDER_NOT_FOUND', 'Folder not found')
      }

      const nextName
        = input.name !== undefined
          ? validateEntryName(input.name, 'request')
          : record.name

      const isFolderChanging = nextFolderId !== record.folderId
      const isNameChanging
        = nextName.toLowerCase() !== record.name.toLowerCase()

      if (!isFolderChanging && isNameChanging) {
        const siblingEntries = [...cache.requestById.values()]
          .filter(r => r.id !== id)
          .map(r => ({ folderId: r.folderId, id: r.id, name: r.name }))
        assertUniqueSiblingEntryName(
          siblingEntries,
          nextFolderId,
          nextName,
          'request',
        )
      }

      record.name = nextName
      record.folderId = nextFolderId
      if (input.method !== undefined)
        record.method = input.method
      if (input.url !== undefined)
        record.url = input.url
      if (input.headers !== undefined)
        record.headers = input.headers
      if (input.query !== undefined)
        record.query = input.query
      if (input.bodyType !== undefined)
        record.bodyType = input.bodyType
      if (input.body !== undefined)
        record.body = input.body
      if (input.formData !== undefined)
        record.formData = input.formData
      if (input.auth !== undefined)
        record.auth = input.auth
      if (input.description !== undefined)
        record.description = input.description

      record.updatedAt = Date.now()

      if (
        previousName !== record.name
        || previousFolderId !== record.folderId
      ) {
        const targetPath = buildRequestFilePath(
          state,
          record.folderId,
          record.name,
        )
        const resolvedPath = getUniqueRequestFilePath(
          paths.httpRoot,
          targetPath,
          previousFilePath,
        )
        if (resolvedPath !== targetPath) {
          record.name = path.posix.basename(resolvedPath, '.md')
        }

        if (resolvedPath !== previousFilePath) {
          moveRequestFile(paths.httpRoot, previousFilePath, resolvedPath)
          record.filePath = resolvedPath

          const indexEntry = state.requests.find(entry => entry.id === id)
          if (indexEntry) {
            indexEntry.filePath = resolvedPath
          }
        }
      }

      writeRequestFile(paths.httpRoot, record)
      saveHttpState(paths, state)

      return { invalidInput: false, notFound: false }
    },

    deleteRequest(id: number) {
      const paths = resolvePaths()
      const cache = getHttpRuntimeCache(paths)
      const { state } = cache
      const record = cache.requestById.get(id)

      if (!record) {
        return { deleted: false }
      }

      removeRequestFile(paths.httpRoot, record.filePath)
      cache.requestById.delete(id)
      state.requests = state.requests.filter(entry => entry.id !== id)

      saveHttpState(paths, state)
      return { deleted: true }
    },
  }
}
