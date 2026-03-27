import interact from 'interactjs'

interface ResizeHandleOptions {
  direction: 'horizontal' | 'vertical'
  onMove: (delta: number) => void
  onStart?: () => void
  onEnd?: () => void
}

export function useResizeHandle(
  handleRef: Ref<HTMLElement | undefined>,
  options: ResizeHandleOptions,
) {
  const isResizing = ref(false)

  watchEffect((onCleanup) => {
    const el = handleRef.value
    if (!el)
      return

    const cursor
      = options.direction === 'horizontal' ? 'col-resize' : 'row-resize'

    const interactable = interact(el).draggable({
      axis: options.direction === 'horizontal' ? 'x' : 'y',
      cursorChecker: () => cursor,
      listeners: {
        start() {
          isResizing.value = true
          el.dataset.resizing = ''
          document.body.style.userSelect = 'none'
          document.body.style.cursor = cursor
          options.onStart?.()
        },
        move(event: any) {
          const delta
            = options.direction === 'horizontal' ? event.dx : event.dy
          options.onMove(delta)
        },
        end() {
          isResizing.value = false
          delete el.dataset.resizing
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
          options.onEnd?.()
        },
      },
    })

    onCleanup(() => interactable.unset())
  })

  return { isResizing }
}
