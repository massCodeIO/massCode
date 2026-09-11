import { useSonner } from '@/composables'
import { i18n } from '@/electron'

export function useCopyToClipboard() {
  const { sonner } = useSonner()

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      sonner({
        id: 'clipboard',
        message: i18n.t('messages:success.copied'),
        type: 'success',
      })
      return true
    }
    catch {
      sonner({
        id: 'clipboard',
        message: i18n.t('messages:error.copyFailed'),
        type: 'error',
      })
      return false
    }
  }

  return copy
}
