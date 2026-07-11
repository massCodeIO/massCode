import path from 'node:path'
import fs from 'fs-extra'

export function toPosixPath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

// Листинг каталога для scan-путей: отсутствующий каталог — валидный пустой
// результат, но любая другая ошибка (EIO, EACCES, сбой облачного провайдера)
// бросается. Тихий пустой listing (как у existsSync, который превращает
// stat-ошибку в false) закоммитил бы усечённый индекс как успешный скан —
// без ошибки reconciler не запустит retry.
export function readDirEntriesFailClosed(currentPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(currentPath, { withFileTypes: true })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export function depthOfRelativePath(relativePath: string): number {
  if (!relativePath) {
    return 0
  }

  return relativePath.split('/').length
}

export function normalizeDirectoryPath(relativePath: string): string {
  if (!relativePath || relativePath === '.') {
    return ''
  }

  return toPosixPath(relativePath)
}

/**
 * Recursively list .md files under rootPath.
 * At root level: enters metaDirName/inbox and metaDirName/trash, skips other hidden dirs.
 * Returns posix-style relative paths.
 */
export function listMarkdownFiles(
  rootPath: string,
  metaDirName: string,
  inboxDirName: string,
  trashDirName: string,
  skipDirNames?: Set<string>,
  currentPath = rootPath,
): string[] {
  const entries = readDirEntriesFailClosed(currentPath)
  const files: string[] = []
  const isRoot = currentPath === rootPath

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name)
    const isHiddenEntry = entry.name.startsWith('.')

    if (entry.isDirectory()) {
      if (isRoot && skipDirNames?.has(entry.name)) {
        continue
      }

      if (isRoot && entry.name === metaDirName) {
        const inboxPath = path.join(absolutePath, inboxDirName)
        const trashPath = path.join(absolutePath, trashDirName)
        files.push(
          ...listMarkdownFiles(
            rootPath,
            metaDirName,
            inboxDirName,
            trashDirName,
            skipDirNames,
            inboxPath,
          ),
        )
        files.push(
          ...listMarkdownFiles(
            rootPath,
            metaDirName,
            inboxDirName,
            trashDirName,
            skipDirNames,
            trashPath,
          ),
        )
        continue
      }

      if (isHiddenEntry) {
        continue
      }

      files.push(
        ...listMarkdownFiles(
          rootPath,
          metaDirName,
          inboxDirName,
          trashDirName,
          skipDirNames,
          absolutePath,
        ),
      )
      continue
    }

    if (entry.isFile() && !isHiddenEntry && entry.name.endsWith('.md')) {
      const relativePath = path.relative(rootPath, absolutePath)
      files.push(toPosixPath(relativePath))
    }
  }

  return files
}
