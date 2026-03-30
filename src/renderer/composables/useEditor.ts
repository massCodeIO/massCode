import type { EditorSettings } from '~/main/store/types'
import { store } from '@/electron'

const cursorPosition = reactive({
  row: 0,
  column: 0,
})

const settings = reactive(
  store.preferences.get('editor.code') as EditorSettings,
)

watch(
  settings,
  () => {
    store.preferences.set('editor.code', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

export function useEditor() {
  return {
    cursorPosition,
    settings,
  }
}
