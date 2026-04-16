import path from 'node:path'
import fs from 'fs-extra'

export interface DirectoryState {
  exists: boolean
  isEmpty: boolean
}

function normalizeAbsolutePath(targetPath: string): string {
  return path.resolve(targetPath)
}

function isNestedPath(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath)

  return (
    relativePath !== ''
    && relativePath !== '.'
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath)
  )
}

function assertMovePathsValid(
  sourcePath: string,
  targetPath: string,
): {
    sourcePath: string
    targetPath: string
  } {
  if (!targetPath.trim()) {
    throw new Error('Target vault path is required.')
  }

  const normalizedSourcePath = normalizeAbsolutePath(sourcePath)
  const normalizedTargetPath = normalizeAbsolutePath(targetPath)

  if (normalizedSourcePath === normalizedTargetPath) {
    throw new Error('Cannot move the vault to the current directory.')
  }

  if (isNestedPath(normalizedSourcePath, normalizedTargetPath)) {
    throw new Error('Cannot move the vault into a nested directory.')
  }

  if (isNestedPath(normalizedTargetPath, normalizedSourcePath)) {
    throw new Error(
      'Cannot move the vault into a parent directory of the current vault.',
    )
  }

  if (!fs.pathExistsSync(normalizedSourcePath)) {
    throw new Error('Current vault path does not exist.')
  }

  return {
    sourcePath: normalizedSourcePath,
    targetPath: normalizedTargetPath,
  }
}

export function getDirectoryState(targetPath: string): DirectoryState {
  if (!fs.pathExistsSync(targetPath)) {
    return {
      exists: false,
      isEmpty: true,
    }
  }

  return {
    exists: true,
    isEmpty: fs.readdirSync(targetPath).length === 0,
  }
}

export function moveVault(sourcePath: string, targetPath: string): void {
  const paths = assertMovePathsValid(sourcePath, targetPath)

  fs.ensureDirSync(paths.targetPath)

  fs.readdirSync(paths.sourcePath).forEach((entry) => {
    fs.moveSync(
      path.join(paths.sourcePath, entry),
      path.join(paths.targetPath, entry),
      { overwrite: true },
    )
  })

  if (
    fs.pathExistsSync(paths.sourcePath)
    && fs.readdirSync(paths.sourcePath).length === 0
  ) {
    fs.removeSync(paths.sourcePath)
  }
}
