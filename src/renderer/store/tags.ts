import { useApi } from '@/composable'
import type { Tag } from '@shared/types/main/db'
import type { State } from '@shared/types/renderer/store/tag'
import { defineStore } from 'pinia'

export const useTagStore = defineStore('tags', {
  state: () =>
    ({
      tags: [],
      selectedId: undefined
    } as State),

  actions: {
    async getTags () {
      const { data } = await useApi('/tags').get().json()
      this.tags = data.value
      this.tags.sort((a, b) => (a.name > b.name ? 1 : -1))
    },
    async postTags (name: string): Promise<Tag> {
      const { data } = await useApi('/tags').post({ name }).json()
      return data.value
    },
    async deleteTagById (id: string) {
      await useApi(`/tags/${id}`).delete()
      await this.getTags()
    }
  }
})
