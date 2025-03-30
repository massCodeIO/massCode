import type { Ref } from 'vue'
import interact from 'interactjs'
import { onMounted, ref } from 'vue'

interface Params {
  target: Ref
  gutter: Ref
  orientation: 'horizontal' | 'vertical'
  options?: {
    minHeight?: number
    minWidth?: number
    maxHeight?: number
    maxWidth?: number
  }
}

export function useGutter(params: Params) {
  const { target, gutter, orientation, options } = params

  const initialWidth = ref(0)
  const initialHeight = ref(0)

  const width = ref(0)
  const height = ref(0)

  onMounted(() => {
    if (!target.value || !gutter.value)
      return console.error('Target or gutter is not defined')

    initialWidth.value = target.value.offsetWidth
    initialHeight.value = target.value.offsetHeight

    interact(target.value).resizable({
      allowFrom: gutter.value.$el,

      // horizontal - движение вверх/вниз (изменение высоты)
      // vertical - движение влево/вправо (изменение ширины)
      edges:
        orientation === 'horizontal'
          ? { left: false, right: false, bottom: true, top: true }
          : { left: true, right: true, bottom: false, top: false },

      modifiers: [
        interact.modifiers.restrictEdges({
          outer: 'parent',
        }),

        interact.modifiers.restrictSize({
          min: {
            height: options?.minHeight || 20,
            width: options?.minWidth || 20,
          },
          max: {
            height: options?.maxHeight || Number.MAX_SAFE_INTEGER,
            width: options?.maxWidth || Number.MAX_SAFE_INTEGER,
          },
        }),
      ],

      listeners: {
        move(event) {
          const targetElement = target.value
          if (!targetElement)
            return

          // horizontal - изменяем высоту
          // vertical - изменяем ширину
          if (orientation === 'horizontal') {
            targetElement.style.height = `${event.rect.height}px`
            height.value = event.rect.height
          }
          else {
            targetElement.style.width = `${event.rect.width}px`
            width.value = event.rect.width
          }
        },
      },
    })
  })

  return {
    initialWidth,
    initialHeight,
    width,
    height,
  }
}
