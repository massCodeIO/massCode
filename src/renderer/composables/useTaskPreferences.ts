import type { TasksSettings } from '~/main/store/types'
import { store } from '@/electron'

const saved = store.preferences.get<Partial<TasksSettings>>('tasks')
const settings = reactive<TasksSettings>({
  autoCleanupCompleted: saved?.autoCleanupCompleted ?? 'never',
})
watch(
  settings,
  () => store.preferences.set('tasks', JSON.parse(JSON.stringify(settings))),
  { deep: true },
)
export function useTaskPreferences() {
  return { settings }
}
