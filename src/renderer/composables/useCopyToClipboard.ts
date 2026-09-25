import { useSonner } from '@/composables'
import { i18n, ipc } from '@/electron'

export function useCopyToClipboard() {
  const { sonner } = useSonner()

  async function copy(value: string) {
    try {
      await ipc.invoke<string, void>('system:clipboard-write-text', value)
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
