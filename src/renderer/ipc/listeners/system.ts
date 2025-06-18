import { useApp, useFolders, useSnippets } from '@/composables'
import { ipc } from '@/electron'

const {
  highlightedFolderId,
  highlightedSnippetIds,
  focusedSnippetId,
  focusedFolderId,
} = useApp()
const { selectFolder } = useFolders()
const { selectSnippet, getSnippets } = useSnippets()

export function registerSystemListeners() {
  ipc.on('system:deep-link', async (_, url: string) => {
    try {
      const u = new URL(url)
      const folderId = u.searchParams.get('folderId')
      const snippetId = u.searchParams.get('snippetId')

      if (folderId && snippetId) {
        highlightedFolderId.value = undefined
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
}
