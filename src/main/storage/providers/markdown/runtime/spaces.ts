import path from 'node:path'
import fs from 'fs-extra'
import { SPACE_STATE_FILE_NAME, SPACES_DIR_NAME } from './constants'

export function getSpaceDirPath(vaultPath: string, spaceId: string): string {
  return path.join(vaultPath, SPACES_DIR_NAME, spaceId)
}

export function ensureSpaceDirectory(
  vaultPath: string,
  spaceId: string,
): string {
  const dirPath = getSpaceDirPath(vaultPath, spaceId)
  fs.ensureDirSync(dirPath)
  return dirPath
}

export function getSpaceStatePath(vaultPath: string, spaceId: string): string {
  return path.join(getSpaceDirPath(vaultPath, spaceId), SPACE_STATE_FILE_NAME)
}
