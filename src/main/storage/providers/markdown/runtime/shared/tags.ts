export interface TagLike {
  createdAt: number
  id: number
  name: string
  updatedAt: number
}

export interface TagStateLike<TTag extends TagLike> {
  counters: {
    tagId: number
  }
  tags: TTag[]
}

export interface TagsEntityLike {
  tags: number[]
}

export function getSortedTagRecords<T extends { id: number, name: string }>(
  tags: T[],
): { id: number, name: string }[] {
  return tags
    .map(tag => ({
      id: tag.id,
      name: tag.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function createTagInState<
  TTag extends TagLike,
  TState extends TagStateLike<TTag>,
>(
  state: TState,
  name: string,
  createTag: (input: { id: number, name: string, now: number }) => TTag,
): { id: number } {
  state.counters.tagId += 1
  const id = state.counters.tagId
  const now = Date.now()

  state.tags.push(createTag({ id, name, now }))

  return { id }
}

export function updateTagInState<TTag extends TagLike>(
  tags: TTag[],
  id: number,
  name: string,
): { notFound: boolean } {
  const tag = tags.find(item => item.id === id)

  if (!tag) {
    return { notFound: true }
  }

  tag.name = name
  tag.updatedAt = Date.now()

  return { notFound: false }
}

export function deleteTagFromStateAndEntities<
  TTag extends { id: number },
  TEntity extends TagsEntityLike,
>(
  state: { tags: TTag[] },
  entities: TEntity[],
  tagId: number,
  onEntityUpdated: (entity: TEntity) => void,
): { deleted: boolean } {
  const tagIndex = state.tags.findIndex(tag => tag.id === tagId)
  if (tagIndex === -1) {
    return { deleted: false }
  }

  state.tags.splice(tagIndex, 1)

  entities.forEach((entity) => {
    if (!entity.tags.includes(tagId)) {
      return
    }

    entity.tags = entity.tags.filter(currentTagId => currentTagId !== tagId)
    onEntityUpdated(entity)
  })

  return { deleted: true }
}
