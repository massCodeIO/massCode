<template>
  <div class="tags">
    <AppInputTags v-model="tags" />
  </div>
</template>

<script setup lang="ts">
import { track } from '@/electron'
import { useAppStore } from '@/store/app'
import { useSnippetStore } from '@/store/snippets'
import { useTagStore } from '@/store/tags'
import { computed } from 'vue'

const tagStore = useTagStore()
const snippetStore = useSnippetStore()
const appStore = useAppStore()

const tags = computed({
  get: () => snippetStore.currentTags.map(i => i.name),
  set: async (v: any) => {
    const tagsIds: string[] = []

    for (const i of v) {
      const tag = tagStore.tags.find(t => t.name === i.text)

      if (tag) {
        tagsIds.push(tag.id)
        track('snippets/add-tag')
      } else {
        if (!i.text) return

        const newTag = await tagStore.postTags(i.text)
        await tagStore.getTags()

        tagsIds.push(newTag.id)

        track('tags/add-new')
      }
    }

    snippetStore.selected!.tagsIds = tagsIds

    await snippetStore.patchSnippetsById(snippetStore.selectedId!, {
      tagsIds
    })
  }
})

const tagsHeight = appStore.sizes.editor.tagsHeight + 'px'
</script>

<style lang="scss" scoped>
.tags {
  height: v-bind(tagsHeight);
  padding: 0 var(--spacing-xs);
  display: flex;
  align-items: center;
}
</style>
