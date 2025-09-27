import { store } from '@/electron'
import { useCssVar } from '@vueuse/core'

const scale = useCssVar('--markdown-scale', document.body, {
  initialValue: store.preferences.get('markdown.scale'),
})

const scaleToShow = computed(() => Number(scale.value).toFixed(1))

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

  scale.value = String(value)
}

export function useMarkdown() {
  return {
    onZoom,
    scaleToShow,
  }
}
