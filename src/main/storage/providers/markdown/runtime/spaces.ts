import path from 'node:path'
import fs from 'fs-extra'
import { PERSISTED_SPACE_IDS, SPACE_STATE_FILE_NAME } from './constants'

// Legacy wrapper directory kept only to migrate early v5 vault layouts.
const LEGACY_SPACES_DIR_NAME = '__spaces__'
const migratedVaultPaths = new Set<string>()

export function ensureFlatSpacesLayout(vaultPath: string): void {
  const normalizedVaultPath = path.resolve(vaultPath)

  if (migratedVaultPaths.has(normalizedVaultPath)) {
    return
  }

  const spacesDir = path.join(normalizedVaultPath, LEGACY_SPACES_DIR_NAME)
  if (fs.pathExistsSync(spacesDir)) {
    PERSISTED_SPACE_IDS.forEach((spaceId) => {
      const legacyPath = path.join(spacesDir, spaceId)
      if (!fs.pathExistsSync(legacyPath)) {
        return
      }

      const targetPath = path.join(normalizedVaultPath, spaceId)
      if (!fs.pathExistsSync(targetPath)) {
        fs.moveSync(legacyPath, targetPath, { overwrite: false })
        return
      }

      const legacyStat = fs.statSync(legacyPath)
      const targetStat = fs.statSync(targetPath)

      if (!legacyStat.isDirectory() || !targetStat.isDirectory()) {
        throw new Error(
          `SPACE_LAYOUT_CONFLICT: cannot migrate ${spaceId} into existing non-directory target`,
        )
      }

      fs.copySync(legacyPath, targetPath, {
        errorOnExist: false,
        overwrite: false,
      })
      fs.removeSync(legacyPath)
    })

    if (
      fs.pathExistsSync(spacesDir)
      && fs.readdirSync(spacesDir).length === 0
    ) {
      fs.removeSync(spacesDir)
    }
  }

  migratedVaultPaths.add(normalizedVaultPath)
}

export function getSpaceDirPath(vaultPath: string, spaceId: string): string {
  ensureFlatSpacesLayout(vaultPath)
  return path.join(vaultPath, spaceId)
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

export function resetMigrationGuardForTesting(): void {
  migratedVaultPaths.clear()
}
