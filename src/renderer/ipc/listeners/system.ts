import {
  type CloudDownloadStatus,
  normalizeCodeSelectionState,
  normalizeNotesSelectionState,
  useApp,
  useCloudDownloads,
  useDrawings,
  useFolders,
  useHttpApp,
  useHttpSpaceInit,
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
const { isHttpSpaceInitialized } = useHttpApp()
const { getFolders } = useFolders()
const { getTags } = useTags()
const {
  selectFirstSnippet,
  displayedSnippets,
  getSnippets,
  refreshSelectedSnippet,
} = useSnippets()
const { hasBusyContentUpdates } = useSnippetUpdate()
const { shouldSkipStorageSyncRefresh } = useStorageMutation()
const { reloadFromDisk: reloadMathFromDisk } = useMathNotebook()
const {
  reloadFromDisk: reloadDrawingsFromDisk,
  hasBusyDrawingUpdates,
  markDrawingsStale,
} = useDrawings()
const { refreshHttpSpaceFromDisk } = useHttpSpaceInit()
const { isNotesSpaceInitialized } = useNotesApp()
const { getNoteFolders } = useNoteFolders()
const { hasBusyNoteContentUpdates, getNotes, refreshSelectedNote } = useNotes()
const { getNoteTags } = useNoteTags()
const { getNotesDashboard } = useNotesDashboard()
const { getNotesGraph } = useNotesGraph()
const { sonner } = useSonner()
const { refreshCloudDownloadStatus, setCloudDownloadStatus }
  = useCloudDownloads()
let storageSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function refreshCodeSpace() {
  const selectedSnippetId = state.snippetId

  await getFolders(false)
  await getTags()
  // Список перезапрашивается явно: облачная докачка снимает
  // pendingCloudDownload и наполняет контент уже показанных записей,
  // но их id не меняются, поэтому реактивность сама не сработает.
  await getSnippets()
  await refreshSelectedSnippet()
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
  isHttpSpaceInitialized.value = false
  markDrawingsStale()

  switch (activeSpace) {
    case 'math':
      await reloadMathFromDisk()
      break
    case 'drawings':
      await reloadDrawingsFromDisk()
      break
    case 'notes':
      await getNoteFolders()
      await getNoteTags()
      // См. комментарий в refreshCodeSpace: список и контент открытой
      // заметки перезапрашиваются явно после облачной докачки.
      await getNotes()
      await refreshSelectedNote()
      await normalizeNotesSelectionState()

      if (router.currentRoute.value.name === RouterName.notesDashboard) {
        await getNotesDashboard()
      }

      if (router.currentRoute.value.name === RouterName.notesGraph) {
        await getNotesGraph()
      }
      break
    case 'http':
      await refreshHttpSpaceFromDisk()
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
      || hasBusyDrawingUpdates()
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
      message: i18n.t('messages:update.availableToast'),
      type: 'success',
      action: {
        label: i18n.t('messages:update.goToGitHub'),
        onClick: () => {
          ipc.invoke('system:open-external', `${repository}/releases`)
        },
      },
    })
  })

  ipc.on('system:update-downloaded', (_, payload: { version: string }) => {
    sonner({
      message: i18n.t('messages:update.downloaded', {
        version: payload.version,
      }),
      type: 'success',
      action: {
        label: i18n.t('messages:update.restart'),
        onClick: () => {
          ipc.invoke('system:install-update', null)
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

  ipc.on(
    'system:cloud-download-progress',
    (_, payload: CloudDownloadStatus) => {
      setCloudDownloadStatus(payload)
    },
  )

  // Начальное состояние очереди докачки: события прогресса, отправленные
  // до загрузки renderer, могли быть пропущены.
  refreshCloudDownloadStatus().catch((error) => {
    console.error('Failed to get cloud download status:', error)
  })

  ipc.on('system:error', (_, payload) => {
    console.error(`[system][${payload.context}]`, payload)
  })
}
