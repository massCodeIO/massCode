import type { HttpRequestListItem } from './useHttpRequests'
import { httpRuntimeNavigation } from './runtimeNavigation'
import { useHttpApp } from './useHttpApp'
import {
  getHttpRequests,
  isRestoreStateBlocked,
  requests,
  selectFirstRequest,
  selectHttpRequest,
  useHttpRequests,
} from './useHttpRequests'

const {
  httpState,
  saveHttpStateSnapshot,
  restoreHttpStateSnapshot,
  stateSnapshots,
} = useHttpApp()

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

async function search(current: () => boolean = () => true) {
  if (searchQuery.value) {
    if (!isSearch.value) {
      saveHttpStateSnapshot('beforeSearch')
    }

    isSearch.value = true
    isRestoreStateBlocked.value = false

    if (!(await getHttpRequests()) || !current())
      return false
    if (!(await selectFirstRequest({ current })))
      return false
    searchSelectedIndex.value = 0
  }
  else {
    isSearch.value = false
  }
  return true
}

async function selectSearchRequest(index: number) {
  if (
    !displayedRequests.value
    || index < 0
    || index >= displayedRequests.value.length
  ) {
    return
  }

  const request = displayedRequests.value[index]
  searchSelectedIndex.value = index
  const { useNavigationHistory } = await import(
    '@/composables/useNavigationHistory'
  )
  await useNavigationHistory().recordNavigation(async () => {
    await selectHttpRequest(request.id)
    return useHttpRequests().currentRequest.value?.id === request.id
  })
}

async function clearSearch(restoreState = false) {
  const shouldRestore = restoreState && !isRestoreStateBlocked.value
  const token = shouldRestore
    ? ++httpRuntimeNavigation.transitionToken
    : httpRuntimeNavigation.transitionToken
  if (
    shouldRestore
    && (!(await httpRuntimeNavigation.confirmLeave())
      || token !== httpRuntimeNavigation.transitionToken)
  ) {
    return false
  }
  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1
  if (shouldRestore) {
    restoreHttpStateSnapshot('beforeSearch')
    if (!httpState.activePanel || httpState.activePanel === 'request') {
      return selectHttpRequest(httpState.requestId, false, {
        preservePanel: true,
      })
    }
  }
  return true
}

function resetHttpSearchState() {
  requestsBySearch.value = undefined
  searchQuery.value = ''
  isSearch.value = false
  searchSelectedIndex.value = -1
  stateSnapshots.beforeSearch = {}
  isRestoreStateBlocked.value = false
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
