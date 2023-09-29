import { useClipboard } from '@vueuse/core'

export function useCopy (value: string) {
  const { copy } = useClipboard()
  copy(value)
}
