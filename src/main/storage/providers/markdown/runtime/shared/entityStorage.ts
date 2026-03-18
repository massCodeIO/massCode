import path from 'node:path'
import fs from 'fs-extra'

interface EntityIndexLike {
  filePath: string
  id: number
}

interface DeletableEntityLike {
  filePath: string
  id: number
  isDeleted: number
}

interface NamedEntityLike {
  id: number
  name: string
}

export interface CreateEntityContext {
  folderId: number | null
  id: number
  name: string
  now: number
}

interface CreateEntityInput<TEntity extends NamedEntityLike> {
  entities: TEntity[]
  folderId: number | null
  name: string
  hasFolder: (folderId: number) => boolean
  onFolderNotFound: () => never
  nextId: () => number
  createEntity: (context: CreateEntityContext) => TEntity
  persistEntity: (entity: TEntity) => void
}

export function createEntityInStateAndDisk<TEntity extends NamedEntityLike>(
  input: CreateEntityInput<TEntity>,
): { id: number } {
  if (input.folderId !== null && !input.hasFolder(input.folderId)) {
    input.onFolderNotFound()
  }

  const id = input.nextId()
  const entity = input.createEntity({
    folderId: input.folderId,
    id,
    name: input.name,
    now: Date.now(),
  })

  input.persistEntity(entity)
  input.entities.push(entity)

  return { id }
}

interface EntityDeleteInput<
  TStateIndex extends EntityIndexLike,
  TRuntimeEntity extends EntityIndexLike,
> {
  id: number
  rootPath: string
  runtimeEntities: TRuntimeEntity[]
  stateEntities: TStateIndex[]
}

function removeFileIfExists(rootPath: string, filePath: string): void {
  const absolutePath = path.join(rootPath, filePath)
  if (fs.pathExistsSync(absolutePath)) {
    fs.removeSync(absolutePath)
  }
}

export function deleteEntityFromStateAndDisk<
  TStateIndex extends EntityIndexLike,
  TRuntimeEntity extends EntityIndexLike,
>(input: EntityDeleteInput<TStateIndex, TRuntimeEntity>): { deleted: boolean } {
  const stateEntityIndex = input.stateEntities.findIndex(
    stateEntity => stateEntity.id === input.id,
  )

  if (stateEntityIndex === -1) {
    return { deleted: false }
  }

  removeFileIfExists(
    input.rootPath,
    input.stateEntities[stateEntityIndex].filePath,
  )
  input.stateEntities.splice(stateEntityIndex, 1)

  const runtimeEntityIndex = input.runtimeEntities.findIndex(
    runtimeEntity => runtimeEntity.id === input.id,
  )
  if (runtimeEntityIndex !== -1) {
    input.runtimeEntities.splice(runtimeEntityIndex, 1)
  }

  return { deleted: true }
}

interface EmptyTrashInput<
  TStateIndex extends EntityIndexLike,
  TRuntimeEntity extends DeletableEntityLike,
> {
  rootPath: string
  runtimeEntities: TRuntimeEntity[]
  stateEntities: TStateIndex[]
}

export function emptyEntityTrashFromStateAndDisk<
  TStateIndex extends EntityIndexLike,
  TRuntimeEntity extends DeletableEntityLike,
>(
  input: EmptyTrashInput<TStateIndex, TRuntimeEntity>,
): { deletedCount: number } {
  const deletedEntities = input.runtimeEntities.filter(
    entity => entity.isDeleted === 1,
  )

  if (!deletedEntities.length) {
    return { deletedCount: 0 }
  }

  deletedEntities.forEach((entity) => {
    removeFileIfExists(input.rootPath, entity.filePath)
  })

  const deletedEntityIds = new Set(deletedEntities.map(entity => entity.id))
  const nextStateEntities = input.stateEntities.filter(
    stateEntity => !deletedEntityIds.has(stateEntity.id),
  )
  input.stateEntities.splice(
    0,
    input.stateEntities.length,
    ...nextStateEntities,
  )

  const nextRuntimeEntities = input.runtimeEntities.filter(
    runtimeEntity => !deletedEntityIds.has(runtimeEntity.id),
  )
  input.runtimeEntities.splice(
    0,
    input.runtimeEntities.length,
    ...nextRuntimeEntities,
  )

  return { deletedCount: deletedEntities.length }
}

interface EntityWithTags {
  tags: number[]
  updatedAt: number
}

interface AddTagToEntityInput<TEntity extends EntityWithTags> {
  entity: TEntity | undefined
  onUpdated: (entity: TEntity) => void
  tagExists: boolean
  tagId: number
}

export function addTagToEntity<TEntity extends EntityWithTags>(
  input: AddTagToEntityInput<TEntity>,
): { entityFound: boolean, tagFound: boolean, updated: boolean } {
  if (!input.entity || !input.tagExists) {
    return {
      entityFound: !!input.entity,
      tagFound: input.tagExists,
      updated: false,
    }
  }

  if (!input.entity.tags.includes(input.tagId)) {
    input.entity.tags.push(input.tagId)
    input.entity.updatedAt = Date.now()
    input.onUpdated(input.entity)

    return {
      entityFound: true,
      tagFound: true,
      updated: true,
    }
  }

  return {
    entityFound: true,
    tagFound: true,
    updated: false,
  }
}
