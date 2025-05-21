import { store } from '@/electron'
import { useCssVar } from '@vueuse/core'

const scale = ref(store.preferences.get('markdown.scale') as number)
const scaleToShow = computed(() => scale.value.toFixed(1))

function onZoom(type: 'in' | 'out') {
  const step = 0.1
  const currentValue = store.preferences.get('markdown.scale') as number
  const value
    = type === 'in'
      ? Number((currentValue + step).toFixed(1))
      : Number((currentValue - step).toFixed(1))

  if (type === 'in') {
    store.preferences.set('markdown.scale', value)
  }
  else {
    if (currentValue - step < 1) {
      return
    }

    store.preferences.set('markdown.scale', value)
  }

  scale.value = value
}

export function useMarkdown() {
  useCssVar('--markdown-scale', document.body, {
    initialValue: String(scale.value),
  })

  return {
    onZoom,
    scaleToShow,
  }
}
