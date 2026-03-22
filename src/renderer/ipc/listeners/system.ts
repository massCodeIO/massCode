import {
  useApp,
  useFolders,
  useMathNotebook,
  useNoteFolders,
  useNotes,
  useNoteTags,
  useSnippets,
  useSnippetUpdate,
  useSonner,
  useStorageMutation,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { getActiveSpaceId } from '@/spaceDefinitions'
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
const { hasBusyContentUpdates } = useSnippetUpdate()
const { shouldSkipStorageSyncRefresh } = useStorageMutation()
const { reloadFromDisk: reloadMathFromDisk } = useMathNotebook()
const { getNoteFolders } = useNoteFolders()
const { getNotes, hasBusyNoteContentUpdates } = useNotes()
const { getNoteTags } = useNoteTags()
const { sonner } = useSonner()
let storageSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null

interface ReleaseNoticePayload {
  sqliteSunsetVersion?: string
}

async function refreshCodeSpace() {
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

async function refreshAfterStorageSync() {
  const activeSpace = getActiveSpaceId()

  switch (activeSpace) {
    case 'math':
      await reloadMathFromDisk()
      break
    case 'notes':
      await getNoteFolders()
      await getNotes()
      await getNoteTags()
      break
    case 'tools':
      break
    case 'code':
    default:
      await refreshCodeSpace()
      break
  }
}

function scheduleStorageSyncRefresh() {
  if (storageSyncDebounceTimer) {
    clearTimeout(storageSyncDebounceTimer)
    storageSyncDebounceTimer = null
  }

  storageSyncDebounceTimer = setTimeout(() => {
    if (
      shouldSkipStorageSyncRefresh()
      || hasBusyContentUpdates()
      || hasBusyNoteContentUpdates()
    ) {
      scheduleStorageSyncRefresh()
      return
    }

    refreshAfterStorageSync().catch((error) => {
      console.error('Failed to refresh after storage sync:', error)
    })
  }, 300)
}

export function registerSystemListeners() {
  ipc.on('system:deep-link', async (_, url: string) => {
    try {
      const u = new URL(url)
      const folderId = u.searchParams.get('folderId')
      const snippetId = u.searchParams.get('snippetId')

      if (folderId && snippetId) {
        const nextFolderId = Number(folderId)
        const nextSnippetId = Number(snippetId)

        highlightedFolderIds.value.clear()
        highlightedSnippetIds.value.clear()
        focusedSnippetId.value = undefined
        focusedFolderId.value = undefined

        await getSnippets({ folderId: nextFolderId })

        await selectFolder(nextFolderId)
        selectSnippet(nextSnippetId)
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
    scheduleStorageSyncRefresh()
  })

  ipc.on('system:error', (_, payload) => {
    console.error(`[system][${payload.context}]`, payload)
  })
}
