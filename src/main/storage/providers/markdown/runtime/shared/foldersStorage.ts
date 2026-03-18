import path from 'node:path'
import fs from 'fs-extra'
import { throwStorageError } from '../validation'
import {
  buildFolderTree,
  collectDescendantIds,
  findFolderByIdPure,
  type FolderLike,
  reorderFolderSiblings,
  sortFoldersForTree,
  type WithChildren,
} from './folderIndex'
import { depthOfRelativePath } from './path'

export function getFoldersSortedByCreatedAt<
  T extends {
    createdAt: number
  },
>(folders: T[]): T[] {
  return [...folders].sort((a, b) => b.createdAt - a.createdAt)
}

export function getFoldersTreeSorted<T extends FolderLike>(
  folders: T[],
): WithChildren<T>[] {
  return buildFolderTree(sortFoldersForTree([...folders]))
}

export function resolveFolderRelativePath(
  folderPathMap: ReadonlyMap<number, string>,
  parentId: number | null,
  name: string,
): string {
  const parentPath
    = parentId !== null ? folderPathMap.get(parentId) : undefined
  return parentPath ? path.posix.join(parentPath, name) : name
}

export interface CreateFolderStateBase<TFolder = unknown> {
  counters: {
    folderId: number
  }
  folders: TFolder[]
}

export interface CreateFolderContext {
  id: number
  name: string
  now: number
  orderIndex: number
  parentId: number | null
}

export function createFolderInStateAndDisk<
  TState extends CreateFolderStateBase,
>(input: {
  state: TState
  rootPath: string
  parentId: number | null
  name: string
  buildFolderPathMap: (state: TState) => Map<number, string>
  getNextFolderOrder: (state: TState, parentId: number | null) => number
  createFolder: (context: CreateFolderContext) => TState['folders'][number]
}): {
    folder: TState['folders'][number]
    folderRelativePath: string
    id: number
  } {
  const folderPathMap = input.buildFolderPathMap(input.state)
  const folderRelativePath = resolveFolderRelativePath(
    folderPathMap,
    input.parentId,
    input.name,
  )
  fs.ensureDirSync(path.join(input.rootPath, folderRelativePath))

  input.state.counters.folderId += 1
  const id = input.state.counters.folderId
  const now = Date.now()

  const folder = input.createFolder({
    id,
    name: input.name,
    now,
    orderIndex: input.getNextFolderOrder(input.state, input.parentId),
    parentId: input.parentId,
  })

  input.state.folders.push(folder)

  return {
    folder,
    folderRelativePath,
    id,
  }
}

export function getFolderPathsByDepth(
  folderPathMap: ReadonlyMap<number, string>,
  folderIds: Iterable<number>,
): string[] {
  return [...folderIds]
    .map(folderId => folderPathMap.get(folderId))
    .filter((folderPath): folderPath is string => !!folderPath)
    .sort((a, b) => depthOfRelativePath(b) - depthOfRelativePath(a))
}

export function removeFolderPathsFromDisk(
  rootPath: string,
  folderPaths: string[],
  options?: { ignoreErrors?: boolean },
): void {
  folderPaths.forEach((folderPath) => {
    const absolutePath = path.join(rootPath, folderPath)
    if (!fs.pathExistsSync(absolutePath)) {
      return
    }

    if (options?.ignoreErrors) {
      try {
        fs.removeSync(absolutePath)
      }
      catch {
        // Non-critical cleanup
      }
      return
    }

    fs.removeSync(absolutePath)
  })
}

export function assertFolderMoveTargetValid<TFolder extends FolderLike>(
  folders: TFolder[],
  folderId: number,
  targetParentId: number | null,
): void {
  if (targetParentId === null) {
    return
  }

  if (!findFolderByIdPure(folders, targetParentId)) {
    throwStorageError('FOLDER_NOT_FOUND', 'Parent folder not found')
  }

  const descendants = collectDescendantIds(folders, folderId)
  if (descendants.has(targetParentId)) {
    throwStorageError(
      'INVALID_NAME',
      'Folder cannot be moved into its own subtree',
    )
  }
}

export function applyFolderParentAndOrder<TFolder extends FolderLike>(
  folders: TFolder[],
  folder: TFolder,
  targetParentId: number | null,
  targetOrderIndex: number,
): { parentChanged: boolean } {
  const currentParentId = folder.parentId
  const currentOrderIndex = folder.orderIndex

  reorderFolderSiblings(
    folders,
    folder.id,
    currentParentId,
    currentOrderIndex,
    targetParentId,
    targetOrderIndex,
  )
  folder.parentId = targetParentId
  folder.orderIndex = targetOrderIndex

  return { parentChanged: targetParentId !== currentParentId }
}

export function moveFolderDirectoryOnDisk(
  rootPath: string,
  oldRelativePath: string,
  newRelativePath: string,
): void {
  if (!oldRelativePath || !newRelativePath) {
    return
  }

  const oldAbsolutePath = path.join(rootPath, oldRelativePath)
  if (!fs.pathExistsSync(oldAbsolutePath)) {
    return
  }

  const newAbsolutePath = path.join(rootPath, newRelativePath)
  fs.ensureDirSync(path.dirname(newAbsolutePath))
  fs.moveSync(oldAbsolutePath, newAbsolutePath, { overwrite: false })
}

export function replaceSubtreePathPrefix(
  filePath: string,
  oldFolderPath: string,
  newFolderPath: string,
): string {
  if (!oldFolderPath || !newFolderPath) {
    return filePath
  }

  const oldFolderPrefix = `${oldFolderPath}/`
  if (!filePath.startsWith(oldFolderPrefix)) {
    return filePath
  }

  return `${newFolderPath}${filePath.slice(oldFolderPath.length)}`
}

export function updateChildEntityPaths<
  TEntity extends { filePath: string },
>(input: {
  entries: TEntity[]
  shouldUpdate?: (entry: TEntity) => boolean
  getNextPath: (entry: TEntity, previousPath: string) => string
  onPathUpdated?: (
    entry: TEntity,
    previousPath: string,
    nextPath: string,
  ) => void
}): void {
  input.entries.forEach((entry) => {
    if (input.shouldUpdate && !input.shouldUpdate(entry)) {
      return
    }

    const previousPath = entry.filePath
    const nextPath = input.getNextPath(entry, previousPath)

    if (!nextPath || nextPath === previousPath) {
      return
    }

    entry.filePath = nextPath
    input.onPathUpdated?.(entry, previousPath, nextPath)
  })
}
