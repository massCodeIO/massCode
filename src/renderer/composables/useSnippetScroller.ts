import { ref } from 'vue'

export const snippetScrollerRef = ref<any>(null)

export function scrollToSnippetIndex(index: number) {
  snippetScrollerRef.value?.scrollToItem(index)
}
