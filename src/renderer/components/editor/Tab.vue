<script setup lang="ts">
import { useSnippets, useSnippetUpdate } from '@/composables'

interface Props {
  name: string
}

const props = defineProps<Props>()

const { selectedSnippetContent, selectedSnippet } = useSnippets()
const { addToUpdateContentQueue } = useSnippetUpdate()

const name = computed({
  get() {
    return props.name
  },
  set(v: string) {
    addToUpdateContentQueue(
      selectedSnippet.value!.id,
      selectedSnippetContent.value!.id,
      {
        label: v,
        language: selectedSnippetContent.value!.language,
        value: selectedSnippetContent.value!.value,
      },
    )
  },
})
</script>

<template>
  <div class="px-2 py-0.5 select-none">
    <UiInput
      v-model="name"
      variant="ghost"
      class="w-full px-0 py-0"
    />
  </div>
</template>
