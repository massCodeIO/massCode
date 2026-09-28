import { ipc } from '@/electron'

export interface CloudDownloadStatus {
  downloaded: number
  downloading: number
  failed: number
  queued: number
}

const status = ref<CloudDownloadStatus>({
  downloaded: 0,
  downloading: 0,
  failed: 0,
  queued: 0,
})

const pendingCount = computed(
  () => status.value.queued + status.value.downloading,
)
const isDownloading = computed(() => pendingCount.value > 0)
const hasFailed = computed(() => status.value.failed > 0)
const isVisible = computed(() => isDownloading.value || hasFailed.value)

function setCloudDownloadStatus(next: CloudDownloadStatus): void {
  status.value = next
}

async function refreshCloudDownloadStatus(): Promise<void> {
  const next = await ipc.invoke<null, CloudDownloadStatus | null>(
    'system:cloud-download-status',
    null,
  )

  if (next) {
    status.value = next
  }
}

export function useCloudDownloads() {
  return {
    hasFailed,
    isDownloading,
    isVisible,
    pendingCount,
    refreshCloudDownloadStatus,
    setCloudDownloadStatus,
    status,
  }
}
