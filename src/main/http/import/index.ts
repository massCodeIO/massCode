import type {
  HttpImportFile,
  HttpImportPersistSummary,
  HttpImportPreview,
  HttpImportResult,
  HttpImportSelection,
} from './types'
import { persistHttpImportResult } from './persist'
import { parsePostmanFiles } from './postman'

export function previewHttpImport(files: HttpImportFile[]): HttpImportPreview {
  const result = parseHttpImportFiles(files)

  return {
    collections: result.collections.map((collection, index) => ({
      folders: collection.folders.length,
      index,
      name: collection.name,
      requests: collection.requests.length,
    })),
    environments: result.environments.map((environment, index) => ({
      index,
      name: environment.name,
      variables: Object.keys(environment.variables).length,
    })),
    warnings: result.warnings,
  }
}

export function applyHttpImport(
  files: HttpImportFile[],
  selection: HttpImportSelection,
): HttpImportPersistSummary {
  return persistHttpImportResult(parseHttpImportFiles(files), selection)
}

export function parseHttpImportFiles(
  files: HttpImportFile[],
): HttpImportResult {
  return parsePostmanFiles(files)
}

export type {
  HttpImportFile,
  HttpImportPersistSummary,
  HttpImportPreview,
  HttpImportResult,
  HttpImportSelection,
  HttpImportWarning,
} from './types'
