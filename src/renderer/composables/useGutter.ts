import type { Ref } from 'vue'
import interact from 'interactjs'
import { onMounted, ref } from 'vue'

export function useGutter(
  target: Ref,
  gutter: Ref,
  initWidth: number = 0,
  minWidth: number = 100,
) {
  const width = ref(initWidth)

  onMounted(() => {
    interact(target.value).resizable({
      allowFrom: gutter.value.$el,

      onmove: (e: Interact.InteractEvent) => {
        const { pageX } = e

        if (pageX < minWidth)
          return
        width.value = Math.floor(pageX)
      },
    })
  })

  return {
    width,
  }
}
