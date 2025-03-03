import type { SnippetsResponse } from '~/renderer/services/api/generated'
import { store } from '@/electron'
import { api } from '~/renderer/services/api'
import { useApp } from './useApp'

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

function selectFirstSnippet() {
  const firstSnippet = snippets.value && snippets.value[0]
  const { selectedSnippetId } = useApp()

  if (firstSnippet) {
    selectedSnippetId.value = firstSnippet.id
    store.app.set('selectedSnippetId', firstSnippet.id)
  }
  else {
    selectedSnippetId.value = undefined
    store.app.delete('selectedSnippetId')
  }
}

export function useSnippets() {
  return {
    getSnippets,
    isSearch,
    searchQuery,
    selectFirstSnippet,
    snippets,
    snippetsBySearch,
  }
}
