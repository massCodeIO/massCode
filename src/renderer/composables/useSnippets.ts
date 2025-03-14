import type {
  SnippetContentsAdd,
  SnippetsQuery,
  SnippetsResponse,
  SnippetsUpdate,
} from '~/renderer/services/api/generated'
import { store } from '@/electron'
import { api } from '~/renderer/services/api'
import { LibraryFilter } from './types'
import { useApp } from './useApp'

type Query = NonNullable<Parameters<typeof api.snippets.getSnippets>[0]>

const {
  selectedSnippetId,
  selectedSnippetContentIndex,
  selectedFolderId,
  selectedLibrary,
} = useApp()

const snippets = shallowRef<SnippetsResponse>()
const snippetsBySearch = shallowRef<SnippetsResponse>()

const searchQuery = ref('')
const isSearch = ref(false)

const selectedSnippet = computed(() => {
  if (isSearch.value) {
    return snippetsBySearch.value?.find(
      s => s.id === selectedSnippetId.value,
    )
  }

  return snippets.value?.find(s => s.id === selectedSnippetId.value)
})

const selectedSnippetContent = computed(() => {
  return selectedSnippet.value?.contents[selectedSnippetContentIndex.value]
})

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: SnippetsQuery = {}

  if (isSearch.value) {
    query.search = searchQuery.value
    return query
  }

  if (selectedFolderId.value) {
    query.folderId = selectedFolderId.value
  }
  else if (selectedLibrary.value === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (selectedLibrary.value === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (selectedLibrary.value === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (selectedLibrary.value === LibraryFilter.Inbox) {
    query.isInbox = 1
  }

  return query
})

const isEmpty = computed(() => {
  if (isSearch.value) {
    return snippetsBySearch.value?.length === 0
  }

  return snippets.value?.length === 0
})

async function getSnippets(query?: Query) {
  const { data } = await api.snippets.getSnippets(query)

  if (isSearch.value) {
    snippetsBySearch.value = data
  }
  else {
    snippets.value = data
  }
}

async function updateSnippet(snippetId: number, data: SnippetsUpdate) {
  await api.snippets.putSnippetsById(String(snippetId), data)
  getSnippets(queryByLibraryOrFolderOrSearch.value)
}

async function updateSnippetContent(
  snippetId: number,
  contentId: number,
  data: SnippetContentsAdd,
) {
  await api.snippets.putSnippetsByIdContentsByContentId(
    String(snippetId),
    String(contentId),
    data,
  )
  getSnippets(queryByLibraryOrFolderOrSearch.value)
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
    selectedSnippet,
    selectedSnippetContent,
    selectFirstSnippet,
    snippets,
    snippetsBySearch,
    updateSnippet,
    updateSnippetContent,
    isEmpty,
  }
}
