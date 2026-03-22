interface EntityWithBodyContent {
  content: string
  updatedAt: number
}

interface OwnerWithNestedContent<TContent> {
  contents: TContent[]
  updatedAt: number
}

interface OwnerWithIdAndNestedContent<TContent>
  extends OwnerWithNestedContent<TContent> {
  id: number
}

type NestedContentOf<TOwner extends OwnerWithNestedContent<unknown>> =
  TOwner extends OwnerWithNestedContent<infer TContent> ? TContent : never

export function updateEntityBodyContent<
  TEntity extends EntityWithBodyContent,
>(input: {
  content: string
  entity: TEntity | undefined
  onAfterPersist?: () => void
  persistEntity: (entity: TEntity) => void
}): { notFound: boolean } {
  if (!input.entity) {
    return { notFound: true }
  }

  input.entity.content = input.content
  input.entity.updatedAt = Date.now()
  input.persistEntity(input.entity)
  input.onAfterPersist?.()

  return { notFound: false }
}

export function createNestedContent<
  TOwner extends OwnerWithNestedContent<unknown>,
>(input: {
  createContent: (id: number) => NestedContentOf<TOwner>
  nextContentId: () => number
  onOwnerNotFound: () => never
  owner: TOwner | undefined
  persistOwner: (owner: TOwner) => void
}): { id: number } {
  if (!input.owner) {
    input.onOwnerNotFound()
  }

  const contentId = input.nextContentId()
  input.owner.contents.push(input.createContent(contentId))
  input.owner.updatedAt = Date.now()
  input.persistOwner(input.owner)

  return { id: contentId }
}

export function updateNestedContent<
  TOwner extends OwnerWithIdAndNestedContent<unknown>,
  TPatch,
>(input: {
  applyPatch: (content: NestedContentOf<TOwner>, patch: TPatch) => void
  findTargetOwnerById: (ownerId: number) => TOwner | undefined
  hasAnyField: (patch: TPatch) => boolean
  ownerId: number
  ownedContent:
    | {
      contentIndex: number
      owner: TOwner
    }
    | undefined
  patch: TPatch
  persistOwner: (owner: TOwner) => void
}): {
    invalidInput: boolean
    notFound: boolean
    parentNotFound: boolean
  } {
  if (!input.hasAnyField(input.patch)) {
    return {
      invalidInput: true,
      notFound: false,
      parentNotFound: false,
    }
  }

  if (!input.ownedContent) {
    return {
      invalidInput: false,
      notFound: true,
      parentNotFound: false,
    }
  }

  const { contentIndex, owner } = input.ownedContent
  const content = owner.contents[contentIndex] as NestedContentOf<TOwner>
  input.applyPatch(content, input.patch)

  let parentNotFound = false
  if (owner.id === input.ownerId) {
    owner.updatedAt = Date.now()
    input.persistOwner(owner)
  }
  else {
    input.persistOwner(owner)

    const targetOwner = input.findTargetOwnerById(input.ownerId)
    if (targetOwner) {
      targetOwner.updatedAt = Date.now()
      input.persistOwner(targetOwner)
    }
    else {
      parentNotFound = true
    }
  }

  return {
    invalidInput: false,
    notFound: false,
    parentNotFound,
  }
}

export function deleteNestedContent<
  TOwner extends OwnerWithIdAndNestedContent<unknown>,
>(input: {
  ownedContent:
    | {
      contentIndex: number
      owner: TOwner
    }
    | undefined
  persistOwner: (owner: TOwner) => void
}): { deleted: boolean } {
  if (!input.ownedContent) {
    return { deleted: false }
  }

  const { contentIndex, owner } = input.ownedContent
  owner.contents.splice(contentIndex, 1)
  owner.updatedAt = Date.now()
  input.persistOwner(owner)

  return { deleted: true }
}
