import { createFetch, useClipboard } from '@vueuse/core'
import mitt from 'mitt'
import type { EmitterEvents } from '@shared/types/renderer/composable'
import { API_PORT } from '../../main/config'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { i18n, ipc, store, track } from '@/electron'
import type { NotificationRequest } from '@shared/types/main'
import type { Snippet, SnippetsSort } from '@shared/types/main/db'
import axios from 'axios'
import { createToast } from 'vercel-toast'

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

export const checkForRemoteNotification = async () => {
  const showMessage = (message: string, date: string | number) => {
    const el = document.createElement('div')
    el.innerHTML = message

    const links = el.querySelectorAll('a')

    links.forEach(i => {
      i.addEventListener('click', e => {
        e.preventDefault()
        ipc.invoke('main:open-url', i.href)
        track('app/notify', i.innerHTML)
      })
    })

    createToast(el, {
      action: {
        text: i18n.t('close'),
        callback (toast) {
          toast.destroy()
          store.app.set('prevRemoteNotice', date)
          track('app/notify', `remoteNotification-${date}`)
        }
      }
    })
  }

  const checkAndShow = async () => {
    try {
      const headers = {
        'Cache-Control': 'no-cache',
        Expires: 0
      }

      const { data } = await axios.get<{ message: string; date: number }>(
        'https://masscode.io/notification.json',
        { headers }
      )

      if (!data) return

      const { message, date } = data
      const prevDate = store.app.get('prevRemoteNotice')

      if (prevDate) {
        if (prevDate < date) showMessage(message, date)
      } else {
        showMessage(message, date)
      }
    } catch (err) {
      console.error(err)
    }
  }

  checkAndShow()

  setInterval(() => {
    checkAndShow()
  }, 1000 * 60 * 180) // 3 часа
}
