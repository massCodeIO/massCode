import type { HttpRequestListItem } from './useHttpRequests'
import { useHttpApp } from './useHttpApp'
import {
  getHttpRequests,
  isRestoreStateBlocked,
  requests,
  saveCurrentRequest,
  selectFirstRequest,
  selectHttpRequest,
} from './useHttpRequests'

const { httpState, saveHttpStateSnapshot, restoreHttpStateSnapshot }
  = useHttpApp()

// --- Module-level state ---

export const requestsBySearch = shallowRef<HttpRequestListItem[]>()
export const isSearch = ref(false)
export const searchQuery = ref('')
const searchSelectedIndex = ref<number>(-1)

// --- Computed ---

const displayedRequests = computed(() => {
  if (isSearch.value) {
    return requestsBySearch.value
  }

  return requests.value
})

// --- Search ---

async function search() {
  if (searchQuery.value) {
    if (!isSearch.value) {
      saveHttpStateSnapshot('beforeSearch')
    }

    isSearch.value = true
    isRestoreStateBlocked.value = false

    await getHttpRequests()
    selectFirstRequest()
    searchSelectedIndex.value = 0
  }
  else {
    isSearch.value = false
  }
}

function selectSearchRequest(index: number) {
  if (
    !displayedRequests.value
    || index < 0
    || index >= displayedRequests.value.length
  ) {
    return
  }

  const request = displayedRequests.value[index]
  selectHttpRequest(request.id)
  searchSelectedIndex.value = index
}

function clearSearch(restoreState = false) {
  const shouldRestore = restoreState && !isRestoreStateBlocked.value

  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1

  if (!shouldRestore) {
    return
  }

  // Сначала сохраняется dirty draft открытого (найденного) запроса, и только
  // потом восстанавливается snapshot: restore меняет httpState.requestId, и
  // ID-guard сохранения увидел бы расхождение — правки молча погибли бы при
  // загрузке восстановленного выбора. При неудачном сохранении выбор
  // остаётся на найденном запросе с правками в редакторе.
  void (async () => {
    if (!(await saveCurrentRequest())) {
      return
    }

    restoreHttpStateSnapshot('beforeSearch')
    await selectHttpRequest(httpState.requestId)
  })()
}

function resetHttpSearchState() {
  requestsBySearch.value = undefined
  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1
}

export function useHttpSearch() {
  return {
    clearSearch,
    displayedRequests,
    isSearch,
    resetHttpSearchState,
    search,
    searchQuery,
    searchSelectedIndex,
    selectSearchRequest,
  }
}
