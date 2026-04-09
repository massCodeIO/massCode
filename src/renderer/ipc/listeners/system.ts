import {
  normalizeCodeSelectionState,
  normalizeNotesSelectionState,
  useApp,
  useFolders,
  useMathNotebook,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNotesDashboard,
  useNotesGraph,
  useNoteTags,
  useSnippets,
  useSnippetUpdate,
  useSonner,
  useStorageMutation,
  useTags,
} from '@/composables'
import { i18n, ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { getActiveSpaceId } from '@/spaceDefinitions'
import { repository } from '../../../../package.json'
import { handleDeepLink } from './deepLinks'

const { state, isCodeSpaceInitialized } = useApp()
const { getFolders } = useFolders()
const { getTags } = useTags()
const { selectFirstSnippet, displayedSnippets } = useSnippets()
const { hasBusyContentUpdates } = useSnippetUpdate()
const { shouldSkipStorageSyncRefresh } = useStorageMutation()
const { reloadFromDisk: reloadMathFromDisk } = useMathNotebook()
const { isNotesSpaceInitialized } = useNotesApp()
const { getNoteFolders } = useNoteFolders()
const { hasBusyNoteContentUpdates } = useNotes()
const { getNoteTags } = useNoteTags()
const { getNotesDashboard } = useNotesDashboard()
const { getNotesGraph } = useNotesGraph()
const { sonner } = useSonner()
let storageSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function refreshCodeSpace() {
  const selectedSnippetId = state.snippetId

  await getFolders(false)
  await getTags()
  await normalizeCodeSelectionState()

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
  isCodeSpaceInitialized.value = false
  isNotesSpaceInitialized.value = false

  switch (activeSpace) {
    case 'math':
      await reloadMathFromDisk()
      break
    case 'notes':
      await getNoteFolders()
      await getNoteTags()
      await normalizeNotesSelectionState()

      if (router.currentRoute.value.name === RouterName.notesDashboard) {
        await getNotesDashboard()
      }

      if (router.currentRoute.value.name === RouterName.notesGraph) {
        await getNotesGraph()
      }
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
      await handleDeepLink(url)
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

  ipc.on(
    'system:migration-complete',
    (_, result: { folders: number, snippets: number, tags: number }) => {
      sonner({
        message: i18n.t('messages:success.migrateToMarkdown', {
          folders: result.folders,
          snippets: result.snippets,
          tags: result.tags,
        }),
        type: 'success',
      })
    },
  )

  ipc.on('system:migration-error', (_, payload: { message: string }) => {
    sonner({
      message: i18n.t('messages:error.migration', {
        error: payload.message,
      }),
      type: 'error',
    })
  })

  ipc.on('system:storage-synced', () => {
    scheduleStorageSyncRefresh()
  })

  ipc.on('system:error', (_, payload) => {
    console.error(`[system][${payload.context}]`, payload)
  })
}
