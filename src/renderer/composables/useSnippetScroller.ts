interface SnippetScroller {
  scrollToItem: (index: number) => void
}

const snippetScrollerRef = ref<SnippetScroller | null>(null)
const pendingScrollIndex = ref<number | null>(null)

export function setSnippetScrollerRef(value: SnippetScroller | null) {
  snippetScrollerRef.value = value

  if (value && pendingScrollIndex.value !== null) {
    const index = pendingScrollIndex.value
    pendingScrollIndex.value = null
    nextTick(() => value.scrollToItem(index))
  }
}

export function scrollToSnippetIndex(index: number) {
  if (index < 0)
    return

  if (snippetScrollerRef.value) {
    snippetScrollerRef.value.scrollToItem(index)
    return
  }

  pendingScrollIndex.value = index
}
