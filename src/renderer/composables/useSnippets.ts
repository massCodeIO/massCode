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
import { useDialog } from './useDialog'

type Query = NonNullable<Parameters<typeof api.snippets.getSnippets>[0]>

const {
  selectedSnippetId,
  selectedSnippetContentIndex,
  selectedFolderId,
  selectedTagId,
  selectedLibrary,
} = useApp()

const selectedSnippetIds = ref<number[]>([])
const lastSelectedSnippetId = ref<number | undefined>()

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

  if (selectedTagId.value) {
    query.tagId = selectedTagId.value
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

    if (
      selectedLibrary.value === LibraryFilter.Trash
      || selectedLibrary.value === LibraryFilter.Favorites
    ) {
      selectedLibrary.value = LibraryFilter.All
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
    selectedSnippetId.value = snippetId
    selectedSnippetContentIndex.value = 0
    store.app.set('selectedSnippetId', snippetId)
    return
  }

  if (selectedSnippetId.value !== undefined) {
    const source = isSearch.value ? snippetsBySearch.value : snippets.value

    if (source) {
      const anchorIndex = source.findIndex(
        s => s.id === selectedSnippetId.value,
      )
      const currentIndex = source.findIndex(s => s.id === snippetId)

      if (anchorIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(anchorIndex, currentIndex)
        const endIndex = Math.max(anchorIndex, currentIndex)

        const newSelection = source
          .slice(startIndex, endIndex + 1)
          .map(s => s.id)
        selectedSnippetIds.value = newSelection

        lastSelectedSnippetId.value = snippetId
        selectedSnippetContentIndex.value = 0
      }
    }
  }
  else {
    selectedSnippetIds.value = [snippetId]
    selectedSnippetId.value = snippetId
    lastSelectedSnippetId.value = snippetId
    selectedSnippetContentIndex.value = 0
    store.app.set('selectedSnippetId', snippetId)
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
    selectedSnippetId.value = firstSnippet.id
    selectedSnippetIds.value = [firstSnippet.id]
    lastSelectedSnippetId.value = firstSnippet.id
    store.app.set('selectedSnippetId', firstSnippet.id)
  }
  else {
    selectedSnippetId.value = undefined
    selectedSnippetIds.value = []
    lastSelectedSnippetId.value = undefined
    store.app.delete('selectedSnippetId')
  }
}

function clearSnippets() {
  snippets.value = []
  snippetsBySearch.value = []
}

function clearSnippetsState() {
  clearSnippets()
  selectedSnippetIds.value = []
  selectedSnippetId.value = undefined
  selectedSnippetContentIndex.value = 0
  store.app.delete('selectedSnippetId')
}

export function useSnippets() {
  return {
    addTagToSnippet,
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
    isSearch,
    lastSelectedSnippetId,
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
