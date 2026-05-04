import type { HttpStorageProvider } from '../../storage/contracts'
import type {
  HttpImportCollection,
  HttpImportEnvironment,
  HttpImportPersistSummary,
  HttpImportResult,
  HttpImportSelection,
} from './types'
import { useHttpStorage } from '../../storage'
import { normalizeImportName } from './normalize'

function parseStorageError(
  error: unknown,
): { code: string, message: string } | null {
  if (!(error instanceof Error)) {
    return null
  }

  const separatorIndex = error.message.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    code: error.message.slice(0, separatorIndex),
    message: error.message.slice(separatorIndex + 1).trim(),
  }
}

function withSuffix(name: string, suffix: number): string {
  return suffix === 0 ? name : `${name} ${suffix}`
}

function createUniqueFolder(
  storage: HttpStorageProvider,
  name: string,
  parentId: number | null,
): { id: number, name: string } {
  const baseName = normalizeImportName(name, 'Imported')

  for (let suffix = 0; suffix <= 10_000; suffix += 1) {
    const candidate = withSuffix(baseName, suffix)
    try {
      const { id } = storage.folders.createFolder({
        name: candidate,
        parentId,
      })
      return { id, name: candidate }
    }
    catch (error) {
      if (parseStorageError(error)?.code !== 'NAME_CONFLICT') {
        throw error
      }
    }
  }

  throw new Error('NAME_CONFLICT:Cannot generate unique folder name')
}

function createUniqueRequest(
  storage: HttpStorageProvider,
  request: HttpImportCollection['requests'][number],
  folderId: number,
): number {
  const baseName = normalizeImportName(request.name, 'Imported request')

  for (let suffix = 0; suffix <= 10_000; suffix += 1) {
    const candidate = withSuffix(baseName, suffix)
    try {
      const { id } = storage.requests.createRequest({
        folderId,
        method: request.method,
        name: candidate,
        url: request.url,
      })

      storage.requests.updateRequest(id, {
        auth: request.auth,
        body: request.body,
        bodyType: request.bodyType,
        description: request.description ?? '',
        formData: request.formData,
        headers: request.headers,
        query: request.query,
      })

      return id
    }
    catch (error) {
      if (parseStorageError(error)?.code !== 'NAME_CONFLICT') {
        throw error
      }
    }
  }

  throw new Error('NAME_CONFLICT:Cannot generate unique request name')
}

function createUniqueEnvironment(
  storage: HttpStorageProvider,
  environment: HttpImportEnvironment,
): number {
  const baseName = normalizeImportName(environment.name, 'Imported')

  for (let suffix = 0; suffix <= 10_000; suffix += 1) {
    const candidate = withSuffix(baseName, suffix)
    try {
      const { id } = storage.environments.createEnvironment({
        name: candidate,
        variables: environment.variables,
      })
      return id
    }
    catch (error) {
      if (parseStorageError(error)?.code !== 'NAME_CONFLICT') {
        throw error
      }
    }
  }

  throw new Error('NAME_CONFLICT:Cannot generate unique environment name')
}

function selectByIndexes<T>(items: T[], indexes: number[] | undefined): T[] {
  if (!indexes) {
    return items
  }

  const indexSet = new Set(indexes)
  return items.filter((_, index) => indexSet.has(index))
}

export function persistHttpImportResult(
  result: HttpImportResult,
  selection: HttpImportSelection = {},
): HttpImportPersistSummary {
  const storage = useHttpStorage()
  const collections = selectByIndexes(
    result.collections,
    selection.selectedCollectionIndexes,
  )
  const environments = selectByIndexes(
    result.environments,
    selection.selectedEnvironmentIndexes,
  )
  const summary: HttpImportPersistSummary = {
    collections: 0,
    createdCollectionNames: [],
    environments: 0,
    folders: 0,
    requests: 0,
    warnings: [...result.warnings],
  }

  for (const collection of collections) {
    const root = createUniqueFolder(storage, collection.name, null)
    const folderIds = new Map<string, number>()
    summary.collections += 1
    summary.folders += 1
    summary.createdCollectionNames.push(root.name)

    for (const folder of collection.folders) {
      const parentId
        = folder.parentId !== null
          ? (folderIds.get(folder.parentId) ?? root.id)
          : root.id
      const created = createUniqueFolder(storage, folder.name, parentId)
      folderIds.set(folder.id, created.id)
      summary.folders += 1
    }

    for (const request of collection.requests) {
      const folderId
        = request.folderId !== null
          ? (folderIds.get(request.folderId) ?? root.id)
          : root.id
      createUniqueRequest(storage, request, folderId)
      summary.requests += 1
    }
  }

  for (const environment of environments) {
    createUniqueEnvironment(storage, environment)
    summary.environments += 1
  }

  return summary
}
