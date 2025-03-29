import type { TagsResponse } from '@/services/api/generated'
import { api } from '@/services/api'

const tags = shallowRef<TagsResponse>([])

async function getTags() {
  const { data } = await api.tags.getTags()
  tags.value = data
}

async function addTag(tagName: string) {
  const { data } = await api.tags.postTags({ name: tagName })

  return data.id as number
}

export function useTags() {
  return {
    tags,
    getTags,
    addTag,
  }
}
