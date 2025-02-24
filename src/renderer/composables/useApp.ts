import { useCssVar } from '@vueuse/core'

const { store } = window.electron

const sidebarWidth = useCssVar('--sidebar-width')
const snippetListWidth = useCssVar('--snippet-list-width')

sidebarWidth.value = `${store.app.get('sidebarWidth')}px`
snippetListWidth.value = `${store.app.get('snippetListWidth')}px`

export function useApp() {
  return {
    sidebarWidth,
    snippetListWidth,
  }
}
