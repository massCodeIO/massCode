import type {
  HttpFolderCreateInput,
  HttpFoldersStorage,
  HttpFolderUpdateInput,
  HttpFolderUpdateResult,
} from '../../../../contracts'
import type {
  HttpFolderRecord,
  HttpRequestIndexItem,
  HttpRequestRecord,
  HttpState,
} from '../runtime/types'
import path from 'node:path'
import fs from 'fs-extra'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { normalizeFlag, normalizeNumber } from '../../runtime/normalizers'
import { getVaultPath } from '../../runtime/paths'
import {
  getFileAvailability,
  markAppWrittenFileAsLocal,
} from '../../runtime/shared/cloudFiles'
import {
  assertEntityFileWritable,
  throwCloudContentUnavailable,
} from '../../runtime/shared/cloudGuards'
import {
  buildFolderPathMap,
  collectDescendantIds,
  getNextFolderOrder,
} from '../../runtime/shared/folderIndex'
import {
  applyFolderParentAndOrder,
  assertFolderMoveTargetValid,
  assertNoUnknownDomainFiles,
  createFolderInStateAndDisk,
  getFolderPathsByDepth,
  getFoldersSortedByCreatedAt,
  getFoldersTreeSorted,
  moveFolderDirectoryOnDisk,
  removeFolderPathsFromDisk,
  replaceSubtreePathPrefix,
  resolveFolderUpdateTargets,
  updateChildEntityPaths,
} from '../../runtime/shared/foldersStorage'
import {
  assertDirectoryNameAvailableAtRoot,
  assertUniqueSiblingFolderName,
  resolveUniqueSiblingFolderName,
  throwStorageError,
  validateEntryName,
} from '../../runtime/validation'
import {
  ensureRequestDetailsLoaded,
  writeRequestFile,
  writeVerifiedMovedLocalRequestFile,
} from '../runtime/parser'
import { getHttpPaths } from '../runtime/paths'
import { saveHttpState } from '../runtime/state'
import { getHttpRuntimeCache, isHttpVaultDiskReady } from '../runtime/sync'

function findHttpFolderById(
  folders: HttpFolderRecord[],
  folderId: number,
): HttpFolderRecord | undefined {
  return folders.find(folder => folder.id === folderId)
}

function syncRequestFolderId(
  records: HttpRequestRecord[],
  indexEntries: HttpRequestIndexItem[],
  pathToFolderId: Map<string, number>,
): void {
  for (const record of records) {
    const indexEntry = indexEntries.find(entry => entry.id === record.id)
    const filePath = indexEntry?.filePath ?? record.filePath
    const dirPath = path.posix.dirname(filePath)
    const nextFolderId
      = dirPath && dirPath !== '.' ? (pathToFolderId.get(dirPath) ?? null) : null
    record.folderId = nextFolderId
  }
}

function getUniqueRootRequestPath(
  httpRoot: string,
  state: HttpState,
  name: string,
  currentFilePath: string,
  reservedPaths?: Set<string>,
): string {
  const targetPath = `${name}.md`
  const targetAbsolutePath = path.join(httpRoot, targetPath)
  const currentAbsolutePath = path.join(httpRoot, currentFilePath)

  if (
    (!fs.pathExistsSync(targetAbsolutePath)
      && !reservedPaths?.has(targetPath.toLowerCase()))
    || targetAbsolutePath.toLowerCase() === currentAbsolutePath.toLowerCase()
  ) {
    return targetPath
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const candidatePath = `${name} ${suffix}.md`
    const candidateAbsolutePath = path.join(httpRoot, candidatePath)

    if (
      !fs.pathExistsSync(candidateAbsolutePath)
      && !reservedPaths?.has(candidatePath.toLowerCase())
    ) {
      return candidatePath
    }
  }

  return `${Date.now()}-${state.counters.requestId}.md`
}

function moveRequestToTrash(
  httpRoot: string,
  state: HttpState,
  record: HttpRequestRecord,
  nextFilePath: string,
  sourceFileVerifiedLocal: boolean,
): void {
  const previousFilePath = record.filePath
  const previousAbsolutePath = path.join(httpRoot, previousFilePath)
  const nextAbsolutePath = path.join(httpRoot, nextFilePath)

  if (nextFilePath === previousFilePath) {
    throw new Error('REQUEST_FILE_MOVE_FAILED:trash path did not change')
  }

  if (sourceFileVerifiedLocal) {
    fs.moveSync(previousAbsolutePath, nextAbsolutePath, { overwrite: false })
  }
  else if (
    fs.pathExistsSync(previousAbsolutePath)
    || fs.pathExistsSync(nextAbsolutePath)
  ) {
    throw new Error(
      'REQUEST_FILE_MOVE_FAILED:path appeared after missing-source preflight',
    )
  }

  record.folderId = null
  record.isDeleted = 1
  record.updatedAt = Date.now()
  record.filePath = nextFilePath

  const indexEntry = state.requests.find(entry => entry.id === record.id)
  if (indexEntry) {
    indexEntry.filePath = nextFilePath
  }

  if (sourceFileVerifiedLocal) {
    writeVerifiedMovedLocalRequestFile(httpRoot, record)
  }
  else {
    writeRequestFile(httpRoot, record)
  }
}

export function createHttpFoldersStorage(): HttpFoldersStorage {
  function resolvePaths() {
    return getHttpPaths(getVaultPath())
  }

  function getCache() {
    return getHttpRuntimeCache(resolvePaths())
  }

  return {
    getFolders() {
      const { state } = getCache()
      return getFoldersSortedByCreatedAt(state.folders)
    },

    getFoldersTree() {
      const { state } = getCache()
      return getFoldersTreeSorted(state.folders)
    },

    createFolder(input: HttpFolderCreateInput) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      const name = validateEntryName(input.name, 'folder')
      const parentId = input.parentId ?? null

      assertUniqueSiblingFolderName(state, parentId, name)

      if (parentId !== null) {
        const parent = findHttpFolderById(state.folders, parentId)
        if (!parent) {
          throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
        }
      }

      const { id: folderId } = createFolderInStateAndDisk({
        buildFolderPathMap: state => buildFolderPathMap(state.folders),
        createFolder: ({ id, name, now, orderIndex, parentId }) => ({
          createdAt: now,
          id,
          icon: input.icon ?? null,
          isOpen: 0,
          name,
          orderIndex,
          parentId,
          updatedAt: now,
        }),
        getNextFolderOrder: (state, parentId) =>
          getNextFolderOrder(state.folders, parentId),
        name,
        parentId,
        rootPath: paths.httpRoot,
        state,
      })
      saveHttpState(paths, state)

      return { id: folderId }
    },

    updateFolder(
      id: number,
      input: HttpFolderUpdateInput,
    ): HttpFolderUpdateResult {
      const paths = resolvePaths()

      // Rename/move каталога до завершения фоновой сверки работал бы по
      // пустому provisional-списку запросов: файлы переместились бы на
      // диске, а index paths остались бы старыми.
      if (
        (input.name !== undefined || input.parentId !== undefined)
        && !isHttpVaultDiskReady(paths)
      ) {
        throwStorageError(
          'VAULT_HYDRATING',
          'Vault is still syncing, folder rename or move is not available yet',
        )
      }

      const cache = getHttpRuntimeCache(paths)
      const { state } = cache
      const folder = findHttpFolderById(state.folders, id)

      if (!folder) {
        return { invalidInput: false, notFound: true }
      }

      if (
        input.name === undefined
        && input.icon === undefined
        && input.parentId === undefined
        && input.isOpen === undefined
        && input.orderIndex === undefined
      ) {
        return { invalidInput: true, notFound: false }
      }

      const now = Date.now()
      let pathChanged = false

      const oldFolderPathMap = buildFolderPathMap(state.folders)
      const oldPath = oldFolderPathMap.get(id)

      let targetName
        = input.name !== undefined
          ? validateEntryName(input.name, 'folder')
          : folder.name

      const { targetOrderIndex, targetParentId } = resolveFolderUpdateTargets(
        folder,
        input,
        normalizeNumber,
      )

      if (input.parentId !== undefined) {
        assertFolderMoveTargetValid(state.folders, id, targetParentId)
      }

      const isParentChanged = targetParentId !== folder.parentId
      if (isParentChanged) {
        targetName = resolveUniqueSiblingFolderName(
          state,
          targetParentId,
          targetName,
          id,
        )
      }
      else if (targetName !== folder.name) {
        assertUniqueSiblingFolderName(state, targetParentId, targetName, id)
      }

      if (targetName !== folder.name) {
        folder.name = targetName
        pathChanged = true
      }

      const { parentChanged } = applyFolderParentAndOrder(
        state.folders,
        folder,
        targetParentId,
        targetOrderIndex,
      )

      if (parentChanged) {
        pathChanged = true
      }

      if (input.isOpen !== undefined) {
        folder.isOpen = normalizeFlag(input.isOpen)
      }

      if (input.icon !== undefined) {
        folder.icon = input.icon
      }

      folder.updatedAt = now

      if (pathChanged) {
        const newFolderPathMap = buildFolderPathMap(state.folders)
        const newPath = newFolderPathMap.get(id)

        if (oldPath && newPath && oldPath !== newPath) {
          const targetParentPath = path.posix.dirname(newPath)
          assertDirectoryNameAvailableAtRoot(
            paths.httpRoot,
            targetParentPath === '.' ? '' : targetParentPath,
            path.posix.basename(newPath),
            oldPath,
          )

          const verifiedLocalRequestIds = new Set<number>()
          for (const record of cache.requestById.values()) {
            const nextRequestPath = replaceSubtreePathPrefix(
              record.filePath,
              oldPath,
              newPath,
            )
            if (nextRequestPath === record.filePath) {
              continue
            }

            const absolutePath = path.join(paths.httpRoot, record.filePath)
            const availability = getFileAvailability(absolutePath)
            if (
              record.pendingCloudDownload
              || availability.isCloudPlaceholder
            ) {
              record.pendingCloudDownload = true
              continue
            }

            if (availability.exists) {
              verifiedLocalRequestIds.add(record.id)
            }
          }

          moveFolderDirectoryOnDisk(paths.httpRoot, oldPath, newPath)

          updateChildEntityPaths({
            entries: [...cache.requestById.values()],
            getNextPath: (_, previousPath) =>
              replaceSubtreePathPrefix(previousPath, oldPath, newPath),
            onPathUpdated: (record, _previousPath, nextPath) => {
              const indexEntry = state.requests.find(r => r.id === record.id)
              if (indexEntry) {
                indexEntry.filePath = nextPath
              }
              const nextAbsolutePath = path.join(paths.httpRoot, nextPath)
              if (verifiedLocalRequestIds.has(record.id)) {
                markAppWrittenFileAsLocal(nextAbsolutePath)
              }
              else if (record.pendingCloudDownload) {
                enqueueCloudDownload(nextAbsolutePath)
              }
            },
          })

          const pathToFolderId = new Map<string, number>()
          newFolderPathMap.forEach((folderPath, folderId) => {
            pathToFolderId.set(folderPath, folderId)
          })
          syncRequestFolderId(
            [...cache.requestById.values()],
            state.requests,
            pathToFolderId,
          )
        }
      }

      saveHttpState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    deleteFolder(id: number) {
      const paths = resolvePaths()

      // До завершения фоновой сверки runtime-кэш provisional: список
      // запросов пуст, перенос содержимого папки в trash ничего бы не нашёл,
      // а removeFolderPathsFromDisk физически уничтожил бы файлы на диске.
      if (!isHttpVaultDiskReady(paths)) {
        throwStorageError(
          'VAULT_HYDRATING',
          'Vault is still syncing, folder deletion is not available yet',
        )
      }

      const cache = getHttpRuntimeCache(paths)
      const { state } = cache
      const folder = findHttpFolderById(state.folders, id)

      if (!folder) {
        return { deleted: false }
      }

      const descendantIds = collectDescendantIds(state.folders, id)
      descendantIds.add(id)

      // Trash-маркер запроса — frontmatter isDeleted, а не путь: перенос
      // недокачанного файла без перезаписи frontmatter «воскресил» бы запрос
      // после докачки. Preflight выполняется до первой мутации в две фазы:
      // сначала eager-дочитка body/description всех записей, затем свежая
      // availability-проверка всех файлов (флаг pendingCloudDownload мог
      // устареть после eviction) — так окно между проверкой и мутацией не
      // растягивается на гидрацию соседей.
      const affectedRecords = [...cache.requestById.values()].filter(
        record =>
          record.folderId !== null && descendantIds.has(record.folderId),
      )
      for (const record of affectedRecords) {
        if (!ensureRequestDetailsLoaded(paths.httpRoot, record)) {
          throwCloudContentUnavailable()
        }
      }

      const folderPathMap = buildFolderPathMap(state.folders)
      const folderPathsToDelete = getFolderPathsByDepth(
        folderPathMap,
        descendantIds,
      )

      // Доменный .md без записи в runtime (плейсхолдер с другого устройства,
      // сбой чтения при скане) физически уничтожился бы вместе с каталогом:
      // удаление отклоняется целиком. Обход стартует с корня удаляемой папки
      // и идёт до финальной stat-фазы, чтобы не расширять окно до мутации.
      const topFolderPath = folderPathMap.get(id)
      assertNoUnknownDomainFiles(
        paths.httpRoot,
        topFolderPath ? [topFolderPath] : [],
        new Set(affectedRecords.map(record => record.filePath)),
      )

      const reservedTargetPaths = new Set<string>()
      const trashPlans: {
        nextFilePath: string
        record: HttpRequestRecord
        sourceFileVerifiedLocal: boolean
      }[] = []
      for (const record of affectedRecords) {
        const absolutePath = path.join(paths.httpRoot, record.filePath)
        assertEntityFileWritable(absolutePath, record)
        const availability = getFileAvailability(absolutePath)
        if (
          availability.exists
          && (!availability.stats || !availability.stats.isFile())
        ) {
          throw new Error(
            'REQUEST_FILE_MOVE_FAILED:source is not a regular file',
          )
        }

        const nextFilePath = getUniqueRootRequestPath(
          paths.httpRoot,
          state,
          record.name,
          record.filePath,
          reservedTargetPaths,
        )
        reservedTargetPaths.add(nextFilePath.toLowerCase())
        trashPlans.push({
          nextFilePath,
          record,
          sourceFileVerifiedLocal:
            availability.exists && !availability.isCloudPlaceholder,
        })
      }

      for (const plan of trashPlans) {
        moveRequestToTrash(
          paths.httpRoot,
          state,
          plan.record,
          plan.nextFilePath,
          plan.sourceFileVerifiedLocal,
        )
      }

      removeFolderPathsFromDisk(paths.httpRoot, folderPathsToDelete, {
        ignoreErrors: true,
      })

      state.folders = state.folders.filter(f => !descendantIds.has(f.id))

      cache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )

      saveHttpState(paths, state)

      return { deleted: true }
    },
  }
}
