import { useFolders, useSnippets } from '@/composables'
import { ipc } from '@/electron'
import { router } from '@/router'

const { createSnippetAndSelect, addFragment } = useSnippets()
const { createFolderAndSelect } = useFolders()

export function registerMainMenuListeners() {
  ipc.on('main-menu:goto-preferences', () => {
    router.push({ name: 'preferences/storage' })
  })

  ipc.on('main-menu:new-snippet', () => {
    createSnippetAndSelect()
  })

  ipc.on('main-menu:new-fragment', () => {
    addFragment()
  })

  ipc.on('main-menu:new-folder', () => {
    createFolderAndSelect()
  })
}
