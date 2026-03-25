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

interface DeletionStateEntityLike {
  isDeleted: number
}

interface NamedEntityLike {
  id: number
  name: string
}

interface UpdatableEntityLike {
  description: string | null
  folderId: number | null
  isDeleted: number
  isFavorites: number
  name: string
}

interface UpdatableEntityInput {
  description?: string | null
  folderId?: number | null
  isDeleted?: number
  isFavorites?: number
  name?: string
}

type UpdatableEntityField = keyof UpdatableEntityInput

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

interface ApplyEntityUpdateInput<
  TEntity extends UpdatableEntityLike,
  TInput extends UpdatableEntityInput,
> {
  entity: TEntity
  fieldPresence: 'defined' | 'in'
  input: TInput
  normalizeFlag: (value: number | undefined, fallback: number) => number
  onMissingFolder: (folderId: number) => never
  resolveName: (inputName: string | undefined, currentName: string) => string
  folderExists: (folderId: number) => boolean
}

function hasInputField<
  TEntity extends UpdatableEntityLike,
  TInput extends UpdatableEntityInput,
>(
  input: ApplyEntityUpdateInput<TEntity, TInput>,
  field: UpdatableEntityField,
): boolean {
  if (input.fieldPresence === 'in') {
    return field in input.input
  }

  const value = (input.input as Record<string, unknown>)[field]
  return value !== undefined
}

export function applyEntityUpdateFields<
  TEntity extends UpdatableEntityLike,
  TInput extends UpdatableEntityInput,
>(
  input: ApplyEntityUpdateInput<TEntity, TInput>,
): {
    hasAnyField: boolean
    pathMayChange: boolean
    previousIsDeleted: number
  } {
  const hasAnyField = (
    ['name', 'description', 'folderId', 'isFavorites', 'isDeleted'] as const
  ).some(field => hasInputField(input, field))

  if (!hasAnyField) {
    return {
      hasAnyField: false,
      pathMayChange: false,
      previousIsDeleted: input.entity.isDeleted,
    }
  }

  const previousIsDeleted = input.entity.isDeleted
  let pathMayChange = false

  if (hasInputField(input, 'name')) {
    input.entity.name = input.resolveName(input.input.name, input.entity.name)
    pathMayChange = true
  }

  if (hasInputField(input, 'description')) {
    input.entity.description = input.input.description ?? null
  }

  if (hasInputField(input, 'folderId')) {
    const nextFolderId = input.input.folderId ?? null
    if (nextFolderId !== null && !input.folderExists(nextFolderId)) {
      input.onMissingFolder(nextFolderId)
    }

    input.entity.folderId = nextFolderId
    pathMayChange = true
  }

  if (hasInputField(input, 'isFavorites')) {
    input.entity.isFavorites = input.normalizeFlag(
      input.input.isFavorites,
      input.entity.isFavorites,
    )
  }

  if (hasInputField(input, 'isDeleted')) {
    input.entity.isDeleted = input.normalizeFlag(
      input.input.isDeleted,
      input.entity.isDeleted,
    )
    pathMayChange = true
  }

  return {
    hasAnyField: true,
    pathMayChange,
    previousIsDeleted,
  }
}

export function getEntityDeleteCounts<TEntity extends DeletionStateEntityLike>(
  entities: TEntity[],
  options?: {
    includeDeletedInTotal?: boolean
  },
): { total: number, trash: number } {
  const trash = entities.filter(entity => entity.isDeleted === 1).length
  const total = options?.includeDeletedInTotal
    ? entities.length
    : entities.filter(entity => entity.isDeleted === 0).length

  return { total, trash }
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

interface DeleteTagFromEntityInput<TEntity extends EntityWithTags> {
  entity: TEntity | undefined
  missingRelationFound: boolean
  onUpdated: (entity: TEntity) => void
  tagExists: boolean
  tagId: number
}

export function deleteTagFromEntity<TEntity extends EntityWithTags>(
  input: DeleteTagFromEntityInput<TEntity>,
): {
    entityFound: boolean
    relationFound: boolean
    tagFound: boolean
    updated: boolean
  } {
  if (!input.entity || !input.tagExists) {
    return {
      entityFound: !!input.entity,
      relationFound: input.missingRelationFound,
      tagFound: input.tagExists,
      updated: false,
    }
  }

  const tagIndex = input.entity.tags.indexOf(input.tagId)
  if (tagIndex === -1) {
    return {
      entityFound: true,
      relationFound: false,
      tagFound: true,
      updated: false,
    }
  }

  input.entity.tags.splice(tagIndex, 1)
  input.entity.updatedAt = Date.now()
  input.onUpdated(input.entity)

  return {
    entityFound: true,
    relationFound: true,
    tagFound: true,
    updated: true,
  }
}
