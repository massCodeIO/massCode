import type {
  SnippetContentsAdd,
  SnippetsQuery,
  SnippetsResponse,
  SnippetsUpdate,
} from '~/renderer/services/api/generated'
import { i18n } from '@/electron'
import { api } from '~/renderer/services/api'
import { LibraryFilter } from './types'
import { useApp } from './useApp'
import { useDialog } from './useDialog'

const { state, saveStateSnapshot, restoreStateSnapshot } = useApp()

const selectedSnippetIds = ref<number[]>([])
const lastSelectedSnippetId = ref<number | undefined>()

const snippets = shallowRef<SnippetsResponse>()
const snippetsBySearch = shallowRef<SnippetsResponse>()

const searchQuery = ref('')
const isSearch = ref(false)
const isRestoreStateBlocked = ref(false)

const displayedSnippets = computed(() => {
  if (isSearch.value) {
    return snippetsBySearch.value
  }

  return snippets.value
})

const selectedSnippet = computed(() => {
  if (isSearch.value) {
    return snippetsBySearch.value?.find(s => s.id === state.snippetId)
  }

  return snippets.value?.find(s => s.id === state.snippetId)
})

const selectedSnippetContent = computed(() => {
  return selectedSnippet.value?.contents[state.snippetContentIndex || 0]
})

const selectedSnippets = computed(() => {
  const source = isSearch.value ? snippetsBySearch.value : snippets.value
  return source?.filter(s => selectedSnippetIds.value.includes(s.id)) || []
})

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: SnippetsQuery = {}

  if (isSearch.value) {
    query.search = searchQuery.value
    return query
  }

  if (state.tagId) {
    query.tagId = state.tagId
    return query
  }

  if (state.folderId) {
    query.folderId = state.folderId
  }
  else if (state.libraryFilter === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (state.libraryFilter === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (state.libraryFilter === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (state.libraryFilter === LibraryFilter.Inbox) {
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

async function getSnippets(query?: SnippetsQuery) {
  const { data } = await api.snippets.getSnippets(
    query || queryByLibraryOrFolderOrSearch.value,
  )

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
      folderId: state.folderId || null,
    })

    await api.snippets.postSnippetsByIdContents(String(data.id), {
      label: `${i18n.t('fragment')} 1`,
      value: '',
      language: 'plain_text',
    })

    if (
      state.libraryFilter === LibraryFilter.Trash
      || state.libraryFilter === LibraryFilter.Favorites
    ) {
      state.libraryFilter = LibraryFilter.All
    }

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

    for (const tag of snippet.tags) {
      await api.snippets.postSnippetsByIdTagsByTagId(
        String(data.id),
        String(tag.id),
      )
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
  await api.snippets.patchSnippetsById(String(snippetId), data)
  await getSnippets(queryByLibraryOrFolderOrSearch.value)
}

async function updateSnippets(snippetIds: number[], data: SnippetsUpdate[]) {
  for (const [index, snippetId] of snippetIds.entries()) {
    await api.snippets.patchSnippetsById(String(snippetId), data[index])
  }
  await getSnippets(queryByLibraryOrFolderOrSearch.value)
}

async function updateSnippetContent(
  snippetId: number,
  contentId: number,
  data: SnippetContentsAdd,
) {
  await api.snippets.patchSnippetsByIdContentsByContentId(
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

async function deleteSnippets(snippetIds: number[]) {
  for (const snippetId of snippetIds) {
    await api.snippets.deleteSnippetsById(String(snippetId))
  }
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

async function addTagToSnippet(tagId: number, snippetId: number) {
  try {
    await api.snippets.postSnippetsByIdTagsByTagId(
      String(snippetId),
      String(tagId),
    )
    await getSnippets(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteTagFromSnippet(tagId: number, snippetId: number) {
  try {
    await api.snippets.deleteSnippetsByIdTagsByTagId(
      String(snippetId),
      String(tagId),
    )
    await getSnippets(queryByLibraryOrFolderOrSearch.value)
  }
  catch (error) {
    console.error(error)
  }
}

async function emptyTrash() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('dialog:emptyTrash'),
    content: i18n.t('dialog:noUndo'),
  })

  if (isConfirmed) {
    await api.snippets.deleteSnippetsTrash()
    await getSnippets(queryByLibraryOrFolderOrSearch.value)
  }
}

function selectSnippet(snippetId: number, withShift = false) {
  if (!withShift) {
    selectedSnippetIds.value = [snippetId]
    state.snippetId = snippetId
    state.snippetContentIndex = 0
    return
  }

  if (state.snippetId !== undefined) {
    const source = isSearch.value ? snippetsBySearch.value : snippets.value

    if (source) {
      const anchorIndex = source.findIndex(s => s.id === state.snippetId)
      const currentIndex = source.findIndex(s => s.id === snippetId)

      if (anchorIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(anchorIndex, currentIndex)
        const endIndex = Math.max(anchorIndex, currentIndex)

        const newSelection = source
          .slice(startIndex, endIndex + 1)
          .map(s => s.id)
        selectedSnippetIds.value = newSelection

        lastSelectedSnippetId.value = snippetId
        state.snippetContentIndex = 0
      }
    }
  }
  else {
    selectedSnippetIds.value = [snippetId]
    lastSelectedSnippetId.value = snippetId
    state.snippetId = snippetId
    state.snippetContentIndex = 0
  }
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
    state.snippetId = firstSnippet.id
    selectedSnippetIds.value = [firstSnippet.id]
    lastSelectedSnippetId.value = firstSnippet.id
  }
  else {
    state.snippetId = undefined
    selectedSnippetIds.value = []
    lastSelectedSnippetId.value = undefined
  }
}

function clearSnippets() {
  snippets.value = []
  snippetsBySearch.value = []
}

function clearSnippetsState() {
  clearSnippets()
  selectedSnippetIds.value = []
  state.snippetId = undefined
  state.snippetContentIndex = 0
}

async function search() {
  if (searchQuery.value) {
    if (!isSearch.value) {
      saveStateSnapshot('beforeSearch')
      state.snippetContentIndex = 0
    }

    isSearch.value = true
    isRestoreStateBlocked.value = false

    await getSnippets({ search: searchQuery.value })
    selectFirstSnippet()
  }
  else {
    isSearch.value = false
  }
}

function clearSearch(restoreState = false) {
  if (restoreState && !isRestoreStateBlocked.value) {
    restoreStateSnapshot('beforeSearch')
  }

  searchQuery.value = ''
  isSearch.value = false
}

export function useSnippets() {
  return {
    addTagToSnippet,
    clearSearch,
    clearSnippets,
    clearSnippetsState,
    createSnippet,
    createSnippetContent,
    deleteSnippet,
    deleteSnippetContent,
    deleteSnippets,
    deleteTagFromSnippet,
    displayedSnippets,
    duplicateSnippet,
    emptyTrash,
    getSnippets,
    isEmpty,
    isRestoreStateBlocked,
    isSearch,
    lastSelectedSnippetId,
    search,
    searchQuery,
    selectedSnippet,
    selectedSnippetContent,
    selectedSnippetIds,
    selectedSnippets,
    selectFirstSnippet,
    selectSnippet,
    updateSnippet,
    updateSnippetContent,
    updateSnippets,
  }
}
