import type { TagsResponse } from '@/services/api/generated'
import { api } from '@/services/api'

const tags = shallowRef<TagsResponse>([])
const isLoading = ref(false)

async function getTags() {
  try {
    isLoading.value = true
    const { data } = await api.tags.getTags()
    tags.value = data
  }
  catch (error) {
    console.error(error)
  }
  finally {
    isLoading.value = false
  }
}

async function addTag(tagName: string) {
  const { data } = await api.tags.postTags({ name: tagName })

  return data.id as number
}

async function deleteTag(tagId: number) {
  try {
    await api.tags.deleteTagsById(String(tagId))
    await getTags()
  }
  catch (error) {
    console.error(error)
  }
}

export function useTags() {
  return {
    addTag,
    deleteTag,
    getTags,
    isLoading,
    tags,
  }
}
