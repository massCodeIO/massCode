import { store } from '@/electron'

const settings = reactive(store.preferences.get('notesEditor'))

watch(
  settings,
  () => {
    store.preferences.set('notesEditor', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

export function useNotesEditor() {
  return {
    settings,
  }
}
