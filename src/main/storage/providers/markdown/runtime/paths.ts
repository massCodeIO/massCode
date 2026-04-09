import type { FolderRecord } from '../../../contracts'
import type { MarkdownState, Paths } from './types'
import path from 'node:path'
import fs from 'fs-extra'
import { store } from '../../../../store'
import { runtimeRef } from './cache'
import {
  CODE_SPACE_ID,
  INBOX_DIR_NAME,
  META_DIR_NAME,
  SPACE_IDS,
  STATE_FILE_NAME,
  TRASH_DIR_NAME,
} from './constants'
import {
  buildFolderPathMap as buildFolderPathMapShared,
  buildPathToFolderIdMap as buildPathToFolderIdMapShared,
  getFolderSiblings as getFolderSiblingsShared,
  getNextFolderOrder as getNextFolderOrderShared,
} from './shared/folderIndex'
import { getSpaceDirPath } from './spaces'

export function getVaultPath(): string {
  const configuredVaultPath = store.preferences.get('storage.vaultPath') as
    | string
    | null
    | undefined

  if (configuredVaultPath && configuredVaultPath.trim()) {
    return configuredVaultPath
  }

  const storagePath = store.preferences.get('storage.rootPath') as string
  return path.join(storagePath, 'markdown-vault')
}

interface LegacyStateFolderLike {
  id: number
  name: string
  orderIndex: number
  parentId: number | null
}

interface MarkdownStateCollectionsLike {
  folders?: unknown[]
  snippets?: unknown[]
  tags?: unknown[]
}

function toTopLevelEntry(relativePath: string): string | null {
  const normalized = relativePath
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .trim()

  if (!normalized) {
    return null
  }

  const [entry] = normalized.split('/')
  return entry || null
}

function readLegacyStateEntries(vaultPath: string): Set<string> {
  const entries = new Set<string>()
  const legacyStatePath = path.join(vaultPath, META_DIR_NAME, STATE_FILE_NAME)
  if (!fs.pathExistsSync(legacyStatePath)) {
    return entries
  }

  try {
    const raw = fs.readJSONSync(legacyStatePath) as {
      folders?: unknown[]
      snippets?: unknown[]
    }

    const folders = (Array.isArray(raw.folders) ? raw.folders : [])
      .map((item): LegacyStateFolderLike | null => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const record = item as {
          id?: unknown
          name?: unknown
          orderIndex?: unknown
          parentId?: unknown
        }

        if (typeof record.id !== 'number' || typeof record.name !== 'string') {
          return null
        }

        return {
          id: record.id,
          name: record.name,
          orderIndex:
            typeof record.orderIndex === 'number' ? record.orderIndex : 0,
          parentId:
            record.parentId === null || typeof record.parentId === 'number'
              ? record.parentId
              : null,
        }
      })
      .filter((item): item is LegacyStateFolderLike => item !== null)

    const folderPathMap = buildFolderPathMapShared(folders)
    folderPathMap.forEach((folderPath) => {
      const topLevelEntry = toTopLevelEntry(folderPath)
      if (topLevelEntry) {
        entries.add(topLevelEntry)
      }
    });
    (Array.isArray(raw.snippets) ? raw.snippets : []).forEach((item) => {
      if (!item || typeof item !== 'object') {
        return
      }

      const snippet = item as { filePath?: unknown }
      if (typeof snippet.filePath !== 'string') {
        return
      }

      const topLevelEntry = toTopLevelEntry(snippet.filePath)
      if (topLevelEntry) {
        entries.add(topLevelEntry)
      }
    })
  }
  catch {
    // Ignore malformed legacy state; fallback logic below will still run.
  }

  return entries
}

function collectLegacyCodeEntries(vaultPath: string): Set<string> {
  const entries = readLegacyStateEntries(vaultPath)

  if (fs.pathExistsSync(path.join(vaultPath, META_DIR_NAME))) {
    entries.add(META_DIR_NAME)
  }

  if (fs.pathExistsSync(path.join(vaultPath, INBOX_DIR_NAME))) {
    entries.add(INBOX_DIR_NAME)
  }

  if (fs.pathExistsSync(path.join(vaultPath, TRASH_DIR_NAME))) {
    entries.add(TRASH_DIR_NAME)
  }

  if (
    entries.size === 0
    && fs.pathExistsSync(path.join(vaultPath, META_DIR_NAME))
  ) {
    fs.readdirSync(vaultPath).forEach((entry) => {
      if (entry !== '__spaces__' && !SPACE_IDS.has(entry)) {
        entries.add(entry)
      }
    })
  }

  return entries
}

function hasLegacyCodeData(vaultPath: string): boolean {
  return collectLegacyCodeEntries(vaultPath).size > 0
}

function isCodeSpaceInitialized(codeRootPath: string): boolean {
  const codeStatePath = path.join(codeRootPath, META_DIR_NAME, STATE_FILE_NAME)
  return fs.pathExistsSync(codeStatePath)
}

function migrateLegacyCodeDataToCodeSpace(
  vaultPath: string,
  codeRootPath: string,
): void {
  const legacyEntries = collectLegacyCodeEntries(vaultPath)
  if (legacyEntries.size === 0) {
    return
  }

  fs.ensureDirSync(codeRootPath)

  legacyEntries.forEach((entry) => {
    if (entry === '__spaces__' || SPACE_IDS.has(entry)) {
      return
    }

    const sourcePath = path.join(vaultPath, entry)
    if (!fs.pathExistsSync(sourcePath)) {
      return
    }

    const targetPath = path.join(codeRootPath, entry)
    if (!fs.pathExistsSync(targetPath)) {
      fs.moveSync(sourcePath, targetPath, { overwrite: false })
      return
    }

    const sourceStat = fs.statSync(sourcePath)
    const targetStat = fs.statSync(targetPath)

    if (sourceStat.isDirectory() && targetStat.isDirectory()) {
      fs.copySync(sourcePath, targetPath, {
        errorOnExist: false,
        overwrite: false,
      })
      fs.removeSync(sourcePath)
    }
  })
}

function resolveCodeVaultPath(vaultPath: string): string {
  const codeRootPath = getSpaceDirPath(vaultPath, CODE_SPACE_ID)
  const shouldMigrateLegacyData
    = hasLegacyCodeData(vaultPath)
      && (!fs.pathExistsSync(codeRootPath) || !isCodeSpaceInitialized(codeRootPath))

  if (shouldMigrateLegacyData) {
    migrateLegacyCodeDataToCodeSpace(vaultPath, codeRootPath)
  }

  fs.ensureDirSync(codeRootPath)
  return codeRootPath
}

export function getPaths(vaultPath: string): Paths {
  const codeVaultPath = resolveCodeVaultPath(vaultPath)
  const metaDirPath = path.join(codeVaultPath, META_DIR_NAME)

  return {
    inboxDirPath: path.join(metaDirPath, INBOX_DIR_NAME),
    metaDirPath,
    statePath: path.join(metaDirPath, 'state.json'),
    trashDirPath: path.join(metaDirPath, TRASH_DIR_NAME),
    vaultPath: codeVaultPath,
  }
}

export function hasMarkdownVaultData(vaultPath: string): boolean {
  const { statePath } = getPaths(vaultPath)

  if (!fs.pathExistsSync(statePath)) {
    return false
  }

  try {
    const state = fs.readJSONSync(statePath) as MarkdownStateCollectionsLike

    return [state.folders, state.snippets, state.tags].some(
      collection => Array.isArray(collection) && collection.length > 0,
    )
  }
  catch {
    return false
  }
}

export {
  depthOfRelativePath,
  normalizeDirectoryPath,
  toPosixPath,
} from './shared/path'

export function buildFolderPathMap(state: MarkdownState): Map<number, string> {
  return buildFolderPathMapShared(state.folders)
}

export function buildPathToFolderIdMap(
  state: MarkdownState,
): Map<string, number> {
  return buildPathToFolderIdMapShared(state.folders)
}

export function findFolderById(
  state: MarkdownState,
  folderId: number,
): FolderRecord | undefined {
  const cache = runtimeRef.cache
  const runtimeCache = cache?.state === state ? cache : null

  if (runtimeCache) {
    if (runtimeCache.folderById.size !== state.folders.length) {
      runtimeCache.folderById = new Map(
        state.folders.map(folder => [folder.id, folder]),
      )
    }

    const folderFromIndex = runtimeCache.folderById.get(folderId)
    if (folderFromIndex) {
      return folderFromIndex
    }
  }

  const folder = state.folders.find(item => item.id === folderId)
  if (folder && runtimeCache) {
    runtimeCache.folderById.set(folderId, folder)
  }

  return folder
}

export function getFolderPathById(
  state: MarkdownState,
  folderId: number,
): string | null {
  const folderPathMap = buildFolderPathMap(state)
  return folderPathMap.get(folderId) || null
}

export function getFolderSiblings(
  state: MarkdownState,
  parentId: number | null,
  excludeId?: number,
): FolderRecord[] {
  return getFolderSiblingsShared(state.folders, parentId, excludeId)
}

export function getNextFolderOrder(
  state: MarkdownState,
  parentId: number | null,
): number {
  return getNextFolderOrderShared(state.folders, parentId)
}
