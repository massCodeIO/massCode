import { LibraryFilter } from '@/composables/types'
import { router, RouterName } from '@/router'
import { httpRuntimeNavigation } from './runtimeNavigation'
import { useHttpApp } from './useHttpApp'
import { useHttpFolders } from './useHttpFolders'
import { useHttpRequests } from './useHttpRequests'
import { useHttpSearch } from './useHttpSearch'

export function useHttpWorkspaceNavigation() {
  async function openHttpLibrary(
    id: 'all' | 'inbox' | 'favorites' | 'trash' | undefined,
    current: () => boolean = () => true,
  ) {
    const token = ++httpRuntimeNavigation.transitionToken
    if (
      !(await httpRuntimeNavigation.confirmLeave())
      || !current()
      || token !== httpRuntimeNavigation.transitionToken
    ) {
      return false
    }
    await router.push({ name: RouterName.httpSpace })
    if (!current() || token !== httpRuntimeNavigation.transitionToken)
      return false
    const { httpState } = useHttpApp()
    const requests = useHttpRequests()
    requests.isRestoreStateBlocked.value = true
    await useHttpSearch().clearSearch()
    httpState.libraryFilter = id
    useHttpFolders().clearFolderSelection()
    const query
      = id === LibraryFilter.Favorites
        ? { isFavorites: 1 as const }
        : id === LibraryFilter.Trash
          ? { isDeleted: 1 as const }
          : id === LibraryFilter.Inbox
            ? { isInbox: 1 as const }
            : { isDeleted: 0 as const }
    if (
      !(await requests.getHttpRequests(query))
      || !current()
      || token !== httpRuntimeNavigation.transitionToken
    ) {
      return false
    }
    if (id !== undefined && !(await requests.selectFirstRequest({ current })))
      return false
    return current() && httpState.libraryFilter === id
  }
  return { openHttpLibrary }
}
