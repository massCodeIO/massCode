import type { HttpRequestDraft } from './useHttpRequests'
import type { HttpFormDataEntry } from '~/main/types/http'
import { ipc, store } from '@/electron'

/** Both the native body editor and AI handoff use the same picker and stale guard. */
export async function chooseHttpFile(
  draft: HttpRequestDraft,
  entry: HttpFormDataEntry | undefined,
  current: () => boolean,
) {
  const vault = store.preferences.get('storage.vaultPath')
  const baseline = JSON.stringify(draft)
  const index = entry ? draft.formData.indexOf(entry) : -1
  if (
    !current()
    || (entry
      ? draft.bodyType !== 'multipart' || index < 0 || entry.type !== 'file'
      : draft.bodyType !== 'binary')
  ) {
    return { status: 'stale' as const }
  }
  const path = await ipc.invoke('main-menu:open-dialog', {
    properties: ['openFile'],
  })
  if (!path)
    return { status: 'cancelled' as const }
  if (
    !current()
    || vault !== store.preferences.get('storage.vaultPath')
    || JSON.stringify(draft) !== baseline
    || (entry && draft.formData[index] !== entry)
  ) {
    return { status: 'stale' as const }
  }
  if (entry)
    entry.value = path
  else draft.body = path
  return { status: 'done' as const, persisted: false }
}
