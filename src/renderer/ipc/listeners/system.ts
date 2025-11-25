import { useApp, useFolders, useSnippets, useSonner } from '@/composables'
import { ipc } from '@/electron'
import { repository } from '../../../../package.json'

const {
  highlightedFolderIds,
  highlightedSnippetIds,
  focusedSnippetId,
  focusedFolderId,
} = useApp()
const { selectFolder } = useFolders()
const { selectSnippet, getSnippets } = useSnippets()
const { sonner } = useSonner()

export function registerSystemListeners() {
  ipc.on('system:deep-link', async (_, url: string) => {
    try {
      const u = new URL(url)
      const folderId = u.searchParams.get('folderId')
      const snippetId = u.searchParams.get('snippetId')

      if (folderId && snippetId) {
        highlightedFolderIds.value.clear()
        highlightedSnippetIds.value.clear()
        focusedSnippetId.value = undefined
        focusedFolderId.value = undefined

        await getSnippets({ folderId })

        await selectFolder(Number(folderId))
        selectSnippet(Number(snippetId))
      }
    }
    catch (error) {
      console.error(error)
    }
  })

  ipc.on('system:update-available', () => {
    sonner({
      message: 'Update available',
      type: 'success',
      action: {
        label: 'Go to GitHub',
        onClick: () => {
          ipc.invoke('system:open-external', `${repository}/releases`)
        },
      },
    })
  })

  ipc.on('system:error', (_, payload) => {
    console.error(`[system][${payload.context}]`, payload)
  })
}
