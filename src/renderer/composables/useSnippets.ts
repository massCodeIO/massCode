import type {
  SnippetContentsAdd,
  SnippetsQuery,
  SnippetsResponse,
  SnippetsUpdate,
} from '~/renderer/services/api/generated'
import { i18n, store } from '@/electron'
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

const displayedSnippets = computed(() => {
  if (isSearch.value) {
    return snippetsBySearch.value
  }

  return snippets.value
})

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

async function createSnippet() {
  try {
    const { data } = await api.snippets.postSnippets({
      name: i18n.t('snippet.untitled'),
      folderId: selectedFolderId.value || null,
    })

    await api.snippets.postSnippetsByIdContents(String(data.id), {
      label: `${i18n.t('fragment')} 1`,
      value: '',
      language: 'plain_text',
    })

    await getSnippets(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

async function duplicateSnippet(snippetId: number) {
  const snippet = snippets.value?.find(s => s.id === snippetId)

  if (!snippet) {
    return
  }

  try {
    const { data } = await api.snippets.postSnippets({
      name: `${snippet.name} - copy`,
      folderId: snippet.folder?.id || null,
    })

    for (const content of snippet.contents) {
      await api.snippets.postSnippetsByIdContents(String(data.id), {
        label: content.label,
        value: content.value,
        language: content.language,
      })
    }

    await getSnippets(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

async function createSnippetContent(snippetId: number) {
  const lastContentIndex = selectedSnippet.value?.contents.length || 0

  try {
    await api.snippets.postSnippetsByIdContents(String(snippetId), {
      label: `${i18n.t('fragment')} ${lastContentIndex + 1}`,
      value: '',
      language: 'plain_text',
    })

    await getSnippets(queryByLibraryOrFolderOrSearch.value)

    return lastContentIndex
  }
  catch (error) {
    console.error(error)
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

async function deleteSnippet(snippetId: number) {
  await api.snippets.deleteSnippetsById(String(snippetId))
  await getSnippets(queryByLibraryOrFolderOrSearch.value)
}

async function deleteSnippetContent(snippetId: number, contentId: number) {
  try {
    await api.snippets.deleteSnippetsByIdContentsByContentId(
      String(snippetId),
      String(contentId),
    )

    await getSnippets(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

function selectSnippet(snippetId: number) {
  selectedSnippetId.value = snippetId
  selectedSnippetContentIndex.value = 0
  store.app.set('selectedSnippetId', snippetId)
}

function selectFirstSnippet() {
  let firstSnippet: SnippetsResponse[0] | undefined

  if (isSearch.value) {
    firstSnippet = snippetsBySearch.value?.[0]
  }
  else {
    firstSnippet = snippets.value?.[0]
  }

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
    createSnippet,
    createSnippetContent,
    deleteSnippet,
    deleteSnippetContent,
    displayedSnippets,
    duplicateSnippet,
    getSnippets,
    isEmpty,
    isSearch,
    searchQuery,
    selectedSnippet,
    selectedSnippetContent,
    selectFirstSnippet,
    selectSnippet,
    updateSnippet,
    updateSnippetContent,
  }
}
