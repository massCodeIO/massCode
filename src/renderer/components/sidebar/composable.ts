import { emitter } from '@/composable'
import { onUnmounted } from 'vue'
import type { Ref } from 'vue'

export const onScrollToFolder = (isFocused: Ref) => {
  if (!isFocused) return

  const handler = () => {
    isFocused.value = false
  }

  emitter.on('scroll-to:folder', handler)

  onUnmounted(() => {
    emitter.off('scroll-to:folder', handler)
  })
}
