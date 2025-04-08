import type { EditorSettings } from '~/main/store/types'
import { store } from '@/electron'

const cursorPosition = reactive({
  row: 0,
  column: 0,
})

const settings = reactive<EditorSettings>(store.preferences.get('editor'))

watch(
  settings,
  () => {
    store.preferences.set('editor', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

export function useEditor() {
  return {
    cursorPosition,
    settings,
  }
}
