import path from 'node:path'
import {
  CODE_SPACE_ID,
  HTTP_SPACE_ID,
  INBOX_DIR_NAME,
  MATH_SPACE_ID,
  META_DIR_NAME,
  NOTES_SPACE_ID,
  SPACE_IDS,
  TRASH_DIR_NAME,
} from './runtime/constants'
import { toPosixPath } from './runtime/shared/path'

export const NOTES_SPACE_WATCH_PREFIX = NOTES_SPACE_ID.toLowerCase()
export const CODE_SPACE_WATCH_PREFIX = CODE_SPACE_ID.toLowerCase()

export function normalizeRelativeWatchPath(
  watchRootPath: string,
  changedPath: string,
): string | null {
  const normalizedChangedPath = changedPath.trim()
  if (!normalizedChangedPath) {
    return null
  }

  const absolutePath = path.isAbsolute(normalizedChangedPath)
    ? normalizedChangedPath
    : path.join(watchRootPath, normalizedChangedPath)
  const relativePath = toPosixPath(path.relative(watchRootPath, absolutePath))

  if (!relativePath || relativePath === '.' || relativePath.startsWith('../')) {
    return null
  }

  return relativePath
}

export function getWatchPathSpaceId(
  relativePath: string | null,
): string | null {
  if (!relativePath) {
    return null
  }

  const [firstSegment] = relativePath.toLowerCase().split('/')
  return firstSegment && SPACE_IDS.has(firstSegment) ? firstSegment : null
}

export function shouldIgnoreWatchPath(
  watchRootPath: string,
  watchPath: string,
): boolean {
  const relativePath = normalizeRelativeWatchPath(watchRootPath, watchPath)
  if (!relativePath) {
    return false
  }

  const basename = path.posix.basename(relativePath)

  if (basename === '.meta.yaml' || basename === '.masscode-folder.yml') {
    return false
  }

  if (getWatchPathSpaceId(relativePath)) {
    return false
  }

  const normalizedRelativePath = relativePath.toLowerCase()
  const metaPrefix = META_DIR_NAME.toLowerCase()
  if (normalizedRelativePath === metaPrefix) {
    return false
  }

  const inboxPrefix = `${META_DIR_NAME}/${INBOX_DIR_NAME}`.toLowerCase()
  const trashPrefix = `${META_DIR_NAME}/${TRASH_DIR_NAME}`.toLowerCase()
  const canContainSnippets
    = normalizedRelativePath === inboxPrefix
      || normalizedRelativePath.startsWith(`${inboxPrefix}/`)
      || normalizedRelativePath === trashPrefix
      || normalizedRelativePath.startsWith(`${trashPrefix}/`)

  if (canContainSnippets) {
    return false
  }

  return normalizedRelativePath
    .split('/')
    .some(segment => segment.startsWith('.'))
}

export function isNotesWatchPath(relativePath: string | null): boolean {
  return getWatchPathSpaceId(relativePath) === NOTES_SPACE_ID
}

export function isCodeWatchPath(relativePath: string | null): boolean {
  return getWatchPathSpaceId(relativePath) === CODE_SPACE_ID
}

export function isMathWatchPath(relativePath: string | null): boolean {
  return getWatchPathSpaceId(relativePath) === MATH_SPACE_ID
}

export function isHttpWatchPath(relativePath: string | null): boolean {
  return getWatchPathSpaceId(relativePath) === HTTP_SPACE_ID
}

export function toCodeRelativePath(relativePath: string): string | null {
  const normalizedRelativePath = relativePath.toLowerCase()

  if (normalizedRelativePath === CODE_SPACE_WATCH_PREFIX) {
    return null
  }

  const codePrefix = `${CODE_SPACE_WATCH_PREFIX}/`
  if (!normalizedRelativePath.startsWith(codePrefix)) {
    return null
  }

  return relativePath.slice(codePrefix.length)
}
