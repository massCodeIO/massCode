import { useClipboard } from '@vueuse/core'

export function useCopy (value: string) {
  console.log(value)
  const { copy } = useClipboard()
  copy(value)
}
