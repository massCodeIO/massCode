import { useSonner } from '@/composables'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'

export function useCopyToClipboard() {
  const { copy: clipboard } = useClipboard()
  const { sonner } = useSonner()

  function copy(value: string) {
    clipboard(value)
    sonner({ message: i18n.t('messages:success.copied'), type: 'success' })
  }

  return copy
}
