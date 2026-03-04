import { useApp, useFolders, useSnippets, useSonner } from '@/composables'
import { i18n, ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { repository } from '../../../../package.json'

const {
  state,
  highlightedFolderIds,
  highlightedSnippetIds,
  focusedSnippetId,
  focusedFolderId,
} = useApp()
const { selectFolder, getFolders } = useFolders()
const { selectSnippet, getSnippets, selectFirstSnippet, displayedSnippets }
  = useSnippets()
const { sonner } = useSonner()
let storageSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null

interface ReleaseNoticePayload {
  sqliteSunsetVersion?: string
}

async function refreshAfterStorageSync() {
  const selectedSnippetId = state.snippetId

  await getFolders(false)
  await getSnippets()

  if (!selectedSnippetId) {
    return
  }

  const snippetExists = displayedSnippets.value?.some(
    snippet => snippet.id === selectedSnippetId,
  )

  if (!snippetExists) {
    selectFirstSnippet()
  }
}

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

  ipc.on('system:feature-notice', (_, payload: ReleaseNoticePayload) => {
    sonner({
      message: i18n.t('messages:release.mdVaultAvailable', {
        sqliteSunsetVersion: payload?.sqliteSunsetVersion || '5.0.0',
      }),
      type: 'success',
      action: {
        label: i18n.t('button.goToSettings'),
        onClick: () => {
          router.push({ name: RouterName.preferencesStorage })
        },
      },
    })
  })

  ipc.on('system:storage-synced', () => {
    if (storageSyncDebounceTimer) {
      clearTimeout(storageSyncDebounceTimer)
      storageSyncDebounceTimer = null
    }

    storageSyncDebounceTimer = setTimeout(() => {
      refreshAfterStorageSync().catch((error) => {
        console.error('Failed to refresh after storage sync:', error)
      })
    }, 300)
  })

  ipc.on('system:error', (_, payload) => {
    console.error(`[system][${payload.context}]`, payload)
  })
}
