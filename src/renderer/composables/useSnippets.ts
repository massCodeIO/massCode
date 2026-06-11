import type {
  SnippetContentsUpdate,
  SnippetItemResponse,
  SnippetsQuery,
  SnippetsResponse,
  SnippetsUpdate,
} from '~/renderer/services/api/generated'
import { useDonations } from '@/composables/useDonations'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { getContiguousSelection } from '@/utils'
import { api } from '~/renderer/services/api'
import { useApp, useDialog, useFolders } from '.'
import { LibraryFilter } from './types'
import { scrollToSnippetIndex } from './useSnippetScroller'

interface CreateSnippetPayload {
  name?: string
}

// Список содержит фрагменты без тел, полная запись выбранного сниппета —
// с телами: value отсутствует, пока полная запись загружается.
interface SnippetContentView {
  id: number
  label: string
  language: string
  value?: string | null
}

type SnippetView = Omit<SnippetItemResponse, 'contents'> & {
  contents: SnippetContentView[]
}

const {
  state,
  saveStateSnapshot,
  restoreStateSnapshot,
  focusSnippetNameInput,
} = useApp()
const { folders, getFolderByIdFromTree } = useFolders()

const selectedSnippetIds = ref<number[]>(
  state.snippetId ? [state.snippetId] : [],
)
const lastSelectedSnippetId = ref<number | undefined>()

const snippets = shallowRef<SnippetsResponse>()
const snippetsBySearch = shallowRef<SnippetsResponse>()

// Список отдаёт только метаданные, поэтому полная запись выбранного
// сниппета (с телами фрагментов) загружается отдельно по id.
const selectedSnippetRecord = shallowRef<SnippetItemResponse | undefined>()
let selectedSnippetRequestToken = 0
let snippetsRequestToken = 0

const searchQuery = ref('')
const isSearch = ref(false)
const isRestoreStateBlocked = ref(false)
const searchSelectedIndex = ref<number>(-1)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextIndexedName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim()
  const indexedNameRe = new RegExp(
    `^${escapeRegExp(normalizedBase)}(?:\\s+(\\d+))?$`,
    'i',
  )

  let maxIndex = 0

  existingNames.forEach((name) => {
    const match = name.trim().match(indexedNameRe)
    if (!match) {
      return
    }

    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })

  return `${normalizedBase} ${maxIndex + 1}`
}

async function getSnippetNamesForCreate(
  folderId: number | null,
): Promise<string[]> {
  const query: SnippetsQuery = { isDeleted: 0 }
  if (folderId !== null) {
    query.folderId = folderId
  }
  else {
    query.isInbox = 1
  }
  const { data } = await api.snippets.getSnippets(query)

  return data
    .filter(snippet => (snippet.folder?.id ?? null) === folderId)
    .map(snippet => snippet.name)
}

const displayedSnippets = computed(() => {
  if (isSearch.value) {
    return snippetsBySearch.value
  }

  return snippets.value
})

const selectedSnippet = computed<SnippetView | undefined>(() => {
  if (selectedSnippetRecord.value?.id === state.snippetId) {
    return selectedSnippetRecord.value
  }

  // Пока полная запись загружается, метаданные берутся из списка,
  // чтобы заголовок и layout не мигали.
  const source = isSearch.value ? snippetsBySearch.value : snippets.value
  return source?.find(s => s.id === state.snippetId)
})

const selectedSnippetContent = computed(() => {
  const record = selectedSnippetRecord.value

  if (!record || record.id !== state.snippetId) {
    return undefined
  }

  return record.contents[state.snippetContentIndex || 0]
})

const selectedSnippets = computed(() => {
  const source = isSearch.value ? snippetsBySearch.value : snippets.value
  if (!source?.length || !selectedSnippetIds.value.length) {
    return []
  }

  const targetIds = new Set(selectedSnippetIds.value)
  return source.filter(s => targetIds.has(s.id))
})

async function refreshSelectedSnippet() {
  const snippetId = state.snippetId
  const requestToken = ++selectedSnippetRequestToken

  if (snippetId === undefined) {
    selectedSnippetRecord.value = undefined
    return
  }

  try {
    const { data } = await api.snippets.getSnippetsById(String(snippetId))

    if (requestToken === selectedSnippetRequestToken) {
      selectedSnippetRecord.value = data
    }
  }
  catch (error) {
    if (requestToken === selectedSnippetRequestToken) {
      selectedSnippetRecord.value = undefined
    }
    console.error(error)
  }
}

watch(
  () => state.snippetId,
  () => {
    void refreshSelectedSnippet()
  },
)

function getActionTargetIds(fallbackSnippetId?: number) {
  if (fallbackSnippetId !== undefined && selectedSnippetIds.value.length > 1) {
    return [...selectedSnippetIds.value]
  }

  if (fallbackSnippetId !== undefined) {
    return [fallbackSnippetId]
  }

  if (selectedSnippetIds.value.length) {
    return [...selectedSnippetIds.value]
  }

  return state.snippetId !== undefined ? [state.snippetId] : []
}

function getActionTargetSnippets(
  targetIds: number[],
  fallbackSnippet?: SnippetsResponse[0],
) {
  const source = displayedSnippets.value || []
  const targetIdSet = new Set(targetIds)
  const targetSnippets = source.filter(snippet =>
    targetIdSet.has(snippet.id),
  )

  if (
    fallbackSnippet
    && targetIds.includes(fallbackSnippet.id)
    && !targetSnippets.some(snippet => snippet.id === fallbackSnippet.id)
  ) {
    targetSnippets.push(fallbackSnippet)
  }

  return targetSnippets
}

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: SnippetsQuery = {}

  if (isSearch.value && searchQuery.value) {
    query.search = searchQuery.value
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

const isAvailableToCodePreview = computed(() => {
  const langAvailable = ['html', 'css', 'javascript']
  return langAvailable.includes(selectedSnippetContent.value?.language || '')
})

async function getSnippets(query?: SnippetsQuery) {
  // Защита от гонки ответов: применяется только самый свежий запрос.
  const requestToken = ++snippetsRequestToken
  const forSearch = isSearch.value

  const { data } = await api.snippets.getSnippets(
    query || queryByLibraryOrFolderOrSearch.value,
  )

  if (requestToken !== snippetsRequestToken) {
    return
  }

  if (forSearch) {
    snippetsBySearch.value = data
  }
  else {
    snippets.value = data
  }
}

async function createSnippet(payload?: CreateSnippetPayload) {
  try {
    const targetFolderId = state.folderId || null
    const folder = getFolderByIdFromTree(folders.value, targetFolderId)
    const existingNames = await getSnippetNamesForCreate(targetFolderId)
    const requestedName = payload?.name?.trim()
    const hasRequestedName = existingNames.some(
      name => name.trim().toLowerCase() === requestedName?.toLowerCase(),
    )
    const nextSnippetName
      = requestedName && !hasRequestedName
        ? requestedName
        : getNextIndexedName(
            requestedName || i18n.t('snippet.untitled'),
            existingNames,
          )

    markPersistedStorageMutation()
    const { data } = await api.snippets.postSnippets({
      name: nextSnippetName,
      folderId: targetFolderId,
    })

    await api.snippets.postSnippetsByIdContents(String(data.id), {
      label: `${i18n.t('common.fragment')} 1`,
      value: '',
      language: folder?.defaultLanguage || 'plain_text',
    })

    useDonations().incrementCreated('code')

    if (
      state.libraryFilter === LibraryFilter.Trash
      || state.libraryFilter === LibraryFilter.Favorites
    ) {
      state.libraryFilter = LibraryFilter.All
    }

    await getSnippets(queryByLibraryOrFolderOrSearch.value)

    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function createSnippetAndSelect(payload?: CreateSnippetPayload) {
  const id = await createSnippet(payload)

  if (id) {
    selectSnippet(id)
  }
  else {
    selectFirstSnippet()
  }

  await focusSnippetNameInput()
}

async function duplicateSnippet(snippetId: number) {
  try {
    // Список не содержит тел фрагментов — источник копии загружается по id.
    const { data: snippet } = await api.snippets.getSnippetsById(
      String(snippetId),
    )

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
  const folder = getFolderByIdFromTree(
    folders.value,
    selectedSnippet.value?.folder?.id || null,
  )

  try {
    await api.snippets.postSnippetsByIdContents(String(snippetId), {
      label: `${i18n.t('common.fragment')} ${lastContentIndex + 1}`,
      value: '',
      language: folder?.defaultLanguage || 'plain_text',
    })

    // Состав списка не меняется — достаточно обновить выбранную запись.
    await refreshSelectedSnippet()

    return lastContentIndex
  }
  catch (error) {
    console.error(error)
  }
}

async function addFragment() {
  if (!selectedSnippet.value) {
    return
  }

  const index = await createSnippetContent(selectedSnippet.value.id)

  if (index) {
    state.snippetContentIndex = index
  }
}

// Поля, влияющие на состав текущего списка: после их изменения нужен refetch.
function isSnippetListMembershipAffecting(data: SnippetsUpdate) {
  return (
    data.folderId !== undefined
    || data.isDeleted !== undefined
    || data.isFavorites !== undefined
  )
}

function patchSnippetInCollections(snippetId: number, data: SnippetsUpdate) {
  const now = Date.now()

  function apply(collection?: SnippetsResponse) {
    if (!collection) {
      return collection
    }

    const index = collection.findIndex(s => s.id === snippetId)
    if (index === -1) {
      return collection
    }

    const next = [...collection]
    next[index] = {
      ...next[index],
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      updatedAt: now,
    }
    return next
  }

  snippets.value = apply(snippets.value)
  snippetsBySearch.value = apply(snippetsBySearch.value)

  const record = selectedSnippetRecord.value
  if (record?.id === snippetId) {
    selectedSnippetRecord.value = {
      ...record,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      updatedAt: now,
    }
  }
}

async function updateSnippet(snippetId: number, data: SnippetsUpdate) {
  markPersistedStorageMutation()
  await api.snippets.patchSnippetsById(String(snippetId), data)

  if (isSnippetListMembershipAffecting(data)) {
    await getSnippets(queryByLibraryOrFolderOrSearch.value)
    await refreshSelectedSnippet()
    return
  }

  // Переименование/описание не меняют состав списка — обновляем точечно.
  patchSnippetInCollections(snippetId, data)
}

async function updateSnippets(snippetIds: number[], data: SnippetsUpdate[]) {
  markPersistedStorageMutation()
  await Promise.all(
    snippetIds.map((snippetId, index) =>
      api.snippets.patchSnippetsById(String(snippetId), data[index]),
    ),
  )
  await getSnippets(queryByLibraryOrFolderOrSearch.value)
  await refreshSelectedSnippet()
}

async function updateSnippetContent(
  snippetId: number,
  contentId: number,
  data: SnippetContentsUpdate,
) {
  markPersistedStorageMutation()
  await api.snippets.patchSnippetsByIdContentsByContentId(
    String(snippetId),
    String(contentId),
    data,
  )

  // Тел фрагментов в списке нет — обновляется только выбранная запись,
  // без перезагрузки списка на каждое сохранение при наборе текста.
  const record = selectedSnippetRecord.value
  if (record?.id === snippetId) {
    selectedSnippetRecord.value = {
      ...record,
      contents: record.contents.map(content =>
        content.id === contentId ? { ...content, ...data } : content,
      ),
      updatedAt: Date.now(),
    }
  }
}

async function deleteSnippet(snippetId: number) {
  markPersistedStorageMutation()
  await api.snippets.deleteSnippetsById(String(snippetId))
  await getSnippets(queryByLibraryOrFolderOrSearch.value)
}

async function deleteSnippets(snippetIds: number[]) {
  markPersistedStorageMutation()
  await Promise.all(
    snippetIds.map(snippetId =>
      api.snippets.deleteSnippetsById(String(snippetId)),
    ),
  )
  await getSnippets(queryByLibraryOrFolderOrSearch.value)
}

async function deleteSelectedSnippets(fallbackSnippet?: SnippetsResponse[0]) {
  const { confirm } = useDialog()
  const targetIds = getActionTargetIds(fallbackSnippet?.id)

  if (!targetIds.length) {
    return
  }

  const targetSnippets = getActionTargetSnippets(targetIds, fallbackSnippet)

  if (targetIds.length > 1) {
    const isAllSoftDeleted
      = targetSnippets.length === targetIds.length
        && targetSnippets.every(snippet => snippet.isDeleted)

    if (isAllSoftDeleted) {
      const isConfirmed = await confirm({
        title: i18n.t('messages:confirm.deleteConfirmMultipleSnippets', {
          count: targetIds.length,
        }),
        content: i18n.t('messages:warning.noUndo'),
      })

      if (isConfirmed) {
        await deleteSnippets(targetIds)
        selectFirstSnippet()
      }
    }
    else {
      const snippetsData = targetIds.map(() => ({
        folderId: null,
        isDeleted: 1,
      }))

      await updateSnippets(targetIds, snippetsData)
      selectFirstSnippet()
    }

    return
  }

  const targetSnippet = targetSnippets[0]

  if (!targetSnippet) {
    return
  }

  if (!targetSnippet.isDeleted) {
    await updateSnippet(targetSnippet.id, {
      folderId: null,
      isDeleted: 1,
    })

    if (state.snippetId === targetSnippet.id) {
      selectFirstSnippet()
    }

    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.deletePermanently', {
      name: targetSnippet.name,
    }),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed) {
    return
  }

  const wasSelected = state.snippetId === targetSnippet.id

  await deleteSnippet(targetSnippet.id)

  if (wasSelected) {
    selectFirstSnippet()
  }
}

async function deleteSnippetContent(snippetId: number, contentId: number) {
  try {
    await api.snippets.deleteSnippetsByIdContentsByContentId(
      String(snippetId),
      String(contentId),
    )

    // Состав списка не меняется — достаточно обновить выбранную запись.
    await refreshSelectedSnippet()
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
    await refreshSelectedSnippet()
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
    await refreshSelectedSnippet()
  }
  catch (error) {
    console.error(error)
  }
}

async function emptyTrash() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.emptyTrash'),
    content: i18n.t('messages:warning.noUndo'),
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

    if (source?.length) {
      const orderedIds = source.map(snippet => snippet.id)
      const rangeSelection = getContiguousSelection(
        orderedIds,
        state.snippetId,
        snippetId,
      )

      if (rangeSelection.length) {
        selectedSnippetIds.value = rangeSelection
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
  selectedSnippetRecord.value = undefined
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

    await getSnippets()
    selectFirstSnippet()
    searchSelectedIndex.value = 0
    nextTick(() => scrollToSnippetIndex(0))
  }
  else {
    isSearch.value = false
  }
}

function selectSearchSnippet(index: number) {
  if (
    !displayedSnippets.value
    || index < 0
    || index >= displayedSnippets.value.length
  ) {
    return
  }

  const snippet = displayedSnippets.value[index]
  selectSnippet(snippet.id)
  searchSelectedIndex.value = index
  nextTick(() => scrollToSnippetIndex(index))
}

function clearSearch(restoreState = false) {
  if (restoreState && !isRestoreStateBlocked.value) {
    restoreStateSnapshot('beforeSearch')
  }

  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1
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
    deleteSelectedSnippets,
    deleteTagFromSnippet,
    displayedSnippets,
    duplicateSnippet,
    emptyTrash,
    getSnippets,
    isEmpty,
    isRestoreStateBlocked,
    isSearch,
    lastSelectedSnippetId,
    addFragment,
    createSnippetAndSelect,
    refreshSelectedSnippet,
    search,
    searchQuery,
    searchSelectedIndex,
    selectedSnippet,
    selectedSnippetContent,
    selectedSnippetIds,
    selectedSnippets,
    selectFirstSnippet,
    selectSearchSnippet,
    selectSnippet,
    updateSnippet,
    updateSnippetContent,
    updateSnippets,
    isAvailableToCodePreview,
  }
}
