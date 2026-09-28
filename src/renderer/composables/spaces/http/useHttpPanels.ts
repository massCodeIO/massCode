import { store } from '@/electron'

const inspectorOpen = ref(
  store.app.get<boolean>('http.layout.inspectorOpen') ?? false,
)
const bottomOpen = ref(
  store.app.get<boolean>('http.layout.bottomOpen') ?? true,
)
const inspectorWidth = ref(
  store.app.get<number>('http.layout.inspectorWidth') ?? 340,
)
watch(inspectorOpen, value =>
  store.app.set('http.layout.inspectorOpen', value))
watch(bottomOpen, value => store.app.set('http.layout.bottomOpen', value))

export function useHttpPanels() {
  return { inspectorOpen, bottomOpen, inspectorWidth }
}
