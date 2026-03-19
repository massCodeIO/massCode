import type { FolderDiskEntry, FolderMetadataSyncSource } from './folderTypes'
import path from 'node:path'
import fs from 'fs-extra'
import { toPosixPath } from './path'

export interface ListUserFoldersOptions<
  TMetadata extends FolderMetadataSyncSource,
> {
  readMetadata: (relativePath: string) => TMetadata
  rootPath: string
  shouldSkipDirectory?: (input: {
    entryName: string
    isRoot: boolean
    relativePath: string
  }) => boolean
}

export function listUserFoldersFromDisk<
  TMetadata extends FolderMetadataSyncSource,
>(options: ListUserFoldersOptions<TMetadata>): FolderDiskEntry<TMetadata>[] {
  const folders: FolderDiskEntry<TMetadata>[] = []

  function walk(currentPath: string): void {
    if (!fs.pathExistsSync(currentPath)) {
      return
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const absolutePath = path.join(currentPath, entry.name)
      const relativePath = toPosixPath(
        path.relative(options.rootPath, absolutePath),
      )
      const isRoot = currentPath === options.rootPath

      if (
        options.shouldSkipDirectory?.({
          entryName: entry.name,
          isRoot,
          relativePath,
        })
      ) {
        continue
      }

      folders.push({
        metadata: options.readMetadata(relativePath),
        path: relativePath,
      })
      walk(absolutePath)
    }
  }

  walk(options.rootPath)

  return folders
}
