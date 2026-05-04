import type {
  HttpImportFile,
  HttpImportPersistSummary,
  HttpImportPreview,
  HttpImportResult,
  HttpImportSelection,
} from './types'
import { parseOpenCollectionFiles } from './opencollection'
import { persistHttpImportResult } from './persist'
import { parsePostmanFiles } from './postman'
import { expandZipFiles } from './zip'

export async function previewHttpImport(
  files: HttpImportFile[],
): Promise<HttpImportPreview> {
  const result = await parseHttpImportFiles(files)

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

export async function applyHttpImport(
  files: HttpImportFile[],
  selection: HttpImportSelection,
): Promise<HttpImportPersistSummary> {
  return persistHttpImportResult(await parseHttpImportFiles(files), selection)
}

export async function parseHttpImportFiles(
  files: HttpImportFile[],
): Promise<HttpImportResult> {
  const expandedFiles = await expandZipFiles(files)
  const postman = parsePostmanFiles(expandedFiles)
  const openCollection = parseOpenCollectionFiles(expandedFiles)

  return {
    collections: [...postman.collections, ...openCollection.collections],
    environments: [...postman.environments, ...openCollection.environments],
    warnings: [...postman.warnings, ...openCollection.warnings],
  }
}

export type {
  HttpImportFile,
  HttpImportPersistSummary,
  HttpImportPreview,
  HttpImportResult,
  HttpImportSelection,
  HttpImportWarning,
} from './types'
