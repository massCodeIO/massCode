import type {
  HttpImportFile,
  HttpImportPersistSummary,
  HttpImportPreview,
  HttpImportResult,
  HttpImportSelection,
} from './types'
import { validateImportFiles } from './limits'
import { parseOpenApiFiles } from './openapi'
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
      runtime: collection.requests
        .filter(request => request.runtime)
        .map(request => ({
          name: request.name,
          assertions: request.runtime?.assertions.length ?? 0,
          scripts: request.scriptStatus ?? 'none',
        })),
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
  validateImportFiles(files)
  const expandedFiles = await expandZipFiles(files)
  validateImportFiles(expandedFiles)
  const postman = parsePostmanFiles(expandedFiles)
  const openCollection = parseOpenCollectionFiles(expandedFiles)
  const openApi = parseOpenApiFiles(expandedFiles)

  if (
    [
      ...postman.collections,
      ...openCollection.collections,
      ...openApi.collections,
    ].reduce((count, collection) => count + collection.requests.length, 0)
    > 1000
  ) {
    throw new Error('spaces.http.import.runtimeWarnings.fileLimit')
  }

  return {
    collections: [
      ...postman.collections,
      ...openCollection.collections,
      ...openApi.collections,
    ],
    environments: [
      ...postman.environments,
      ...openCollection.environments,
      ...openApi.environments,
    ],
    warnings: [
      ...postman.warnings,
      ...openCollection.warnings,
      ...openApi.warnings,
    ],
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
