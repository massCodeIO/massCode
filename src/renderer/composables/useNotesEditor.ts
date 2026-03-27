import type { NotesEditorSettings } from '~/main/store/types'
import { store } from '@/electron'

const settings = reactive(
  store.preferences.get('editor.notes') as NotesEditorSettings,
)

watch(
  settings,
  () => {
    store.preferences.set('editor.notes', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

export function useNotesEditor() {
  return {
    settings,
  }
}
