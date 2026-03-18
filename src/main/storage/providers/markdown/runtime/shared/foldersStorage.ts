import path from 'node:path'
import fs from 'fs-extra'
import {
  buildFolderTree,
  type FolderLike,
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

export interface CreateFolderStateBase<TFolder> {
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
  TFolder,
  TState extends CreateFolderStateBase<TFolder>,
>(input: {
  state: TState
  rootPath: string
  parentId: number | null
  name: string
  buildFolderPathMap: (state: TState) => Map<number, string>
  getNextFolderOrder: (state: TState, parentId: number | null) => number
  createFolder: (context: CreateFolderContext) => TFolder
}): { folder: TFolder, folderRelativePath: string, id: number } {
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
