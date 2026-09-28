import type { NoteExportWarnings } from '~/main/types/ipc'
import { useSonner } from '@/composables/useSonner'
import { i18n } from '@/electron'

export function showNoteExportWarnings(warnings?: NoteExportWarnings): boolean {
  const entries = Object.entries(warnings ?? {}).filter(
    ([, count]) => count > 0,
  )
  if (!entries.length)
    return false
  useSonner().sonner({
    type: 'warning',
    message: i18n.t('messages:warning.noteExportIncomplete', {
      details: entries
        .map(
          ([kind, count]) =>
            `${i18n.t(`messages:warning.noteExportLoss.${kind}`)}: ${count}`,
        )
        .join('; '),
    }),
  })
  return true
}
