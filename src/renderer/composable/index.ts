import { createFetch, useClipboard } from '@vueuse/core'
import mitt from 'mitt'
import type { EmitterEvents } from '@shared/types/renderer/composable'
import { API_PORT } from '../../main/config'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { ipc, track } from '@/electron'
import type { NotificationRequest } from '@shared/types/main'
import type { Snippet, SnippetsSort } from '@shared/types/main/db'

export const useApi = createFetch({
  baseUrl: `http://localhost:${API_PORT}`
})

export const emitter = mitt<EmitterEvents>()

export const onAddNewSnippet = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  await snippetStore.addNewSnippet()

  if (folderStore.selectedId) {
    await snippetStore.getSnippetsByFolderIds(folderStore.selectedIds!)
  } else {
    snippetStore.setSnippetsByAlias('inbox')
  }

  emitter.emit('snippet:focus-name', true)
  track('snippets/add-new')
}

export const onCreateSnippet = async (body: Partial<Snippet>) => {
  const snippetStore = useSnippetStore()

  await snippetStore.addNewSnippet(body)
  await snippetStore.getSnippets()
  snippetStore.setSnippetsByAlias('inbox')
  track('api/snippet-create')
}

export const onAddNewFragment = async () => {
  const snippetStore = useSnippetStore()

  await snippetStore.addNewFragmentToSnippetsById(snippetStore.selectedId!)
  track('snippets/add-fragment')
}

export const onAddDescription = async () => {
  const snippetStore = useSnippetStore()

  if (typeof snippetStore.selected?.description === 'string') return

  if (
    snippetStore.selected?.description === undefined ||
    snippetStore.selected?.description === null
  ) {
    await snippetStore.patchSnippetsById(snippetStore.selectedId!, {
      description: ''
    })
  }

  track('snippets/add-description')
}

export const onAddNewFolder = async () => {
  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  const folder = await folderStore.addNewFolder()
  snippetStore.selected = undefined

  emitter.emit('scroll-to:folder', folder.id)
  track('folders/add-new')
}

export const onCopySnippet = () => {
  const snippetStore = useSnippetStore()

  const { copy } = useClipboard({ source: snippetStore.currentContent })
  copy()

  ipc.invoke<any, NotificationRequest>('main:notification', {
    body: 'Snippet copied'
  })
  track('snippets/copy')
}

export const goToSnippet = async (snippetId: string) => {
  if (!snippetId) return

  const folderStore = useFolderStore()
  const snippetStore = useSnippetStore()

  const snippet = snippetStore.findSnippetById(snippetId)

  if (!snippet) return

  folderStore.selectId(snippet.folderId)

  expandParentFolders(snippet.folderId)

  snippetStore.fragment = 0

  await snippetStore.getSnippetsById(snippetId)
  await snippetStore.setSnippetsByFolderIds()

  emitter.emit('folder:click', snippet.folderId)
  emitter.emit('scroll-to:snippet', snippetId)
  emitter.emit('scroll-to:folder', snippet.folderId)
}

export const expandParentFolders = (folderId: string) => {
  const folderStore = useFolderStore()

  const findParentAndExpand = async (id: string) => {
    const folder = folderStore.folders.find(i => i.id === id)

    if (!folder) return

    await folderStore.patchFoldersById(folder.id, {
      isOpen: true
    })

    if (folder.parentId) {
      findParentAndExpand(folder.parentId)
    }
  }

  findParentAndExpand(folderId)
}

export const setScrollPosition = (el: HTMLElement, offset: number) => {
  const ps = el.querySelector('.ps')
  if (ps) ps.scrollTop = offset
}

export const sortSnippetsBy = (snippets: Snippet[], sort: SnippetsSort) => {
  if (sort === 'updatedAt') {
    snippets.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
  }

  if (sort === 'createdAt') {
    snippets.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  }

  if (sort === 'name') {
    snippets.sort((a, b) =>
      a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
    )
  }
}

export const useHljsTheme = async (theme: 'dark' | 'light') => {
  const { default: darkCSS } = await import(
    'highlight.js/styles/base16/material.css?raw'
  )
  const { default: lightCSS } = await import(
    'highlight.js/styles/github.css?raw'
  )

  document.querySelector('[data=hljs-theme]')?.remove()

  const style = document.createElement('style')
  style.setAttribute('data', 'hljs-theme')

  if (theme === 'dark') {
    style.innerHTML = darkCSS
  } else {
    style.innerHTML = lightCSS
  }

  document.head.appendChild(style)
}

export const onClickUrl = (url: string) => {
  ipc.invoke('main:open-url', url)
  track('app/open-url', url)
}
