import type { SnippetsResponse } from '~/renderer/services/api/generated'
import { api } from '~/renderer/services/api'

type Query = NonNullable<Parameters<typeof api.snippets.getSnippets>[0]>

const snippets = shallowRef<SnippetsResponse>()
const snippetsBySearch = shallowRef<SnippetsResponse>()

const searchQuery = ref('')
const isSearch = ref(false)

async function getSnippets(query?: Query) {
  const { data } = await api.snippets.getSnippets(query)

  if (isSearch.value) {
    snippetsBySearch.value = data
  }
  else {
    snippets.value = data
  }
}

export function useSnippets() {
  return {
    getSnippets,
    isSearch,
    searchQuery,
    snippets,
    snippetsBySearch,
  }
}
