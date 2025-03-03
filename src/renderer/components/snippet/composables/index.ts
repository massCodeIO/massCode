const highlightedId = ref<number>()

export function useSnippetsStore() {
  return {
    highlightedId,
  }
}
