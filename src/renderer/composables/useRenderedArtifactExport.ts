import type {
  RenderedArtifactExportPayload,
  RenderedArtifactExportResult,
} from '~/main/types/ipc'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc, store } from '@/electron'

/** The producer captures a specific native view; no clipboard or file paths come from a model. */
export async function saveRenderedArtifact(
  format: RenderedArtifactExportPayload['format'],
  name: string,
  produce: () => Promise<string>,
  isCurrent: () => boolean,
): Promise<RenderedArtifactExportResult> {
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  try {
    const data = await produce()
    if (
      !isCurrent()
      || vault !== (store.preferences.get<string>('storage.vaultPath') ?? '')
    ) {
      return { status: 'stale' }
    }
    const result = await ipc.invoke<
      RenderedArtifactExportPayload,
      RenderedArtifactExportResult
    >('fs:export-rendered-artifact', { format, name, data, vault })
    if (result.status === 'saved') {
      useSonner().sonner({
        type: 'success',
        message: i18n.t('messages:success.artifactExported'),
      })
    }
    return result
  }
  catch {
    useSonner().sonner({
      type: 'error',
      message: i18n.t('messages:error.artifactExportFailed'),
    })
    return { status: 'failed' }
  }
}
