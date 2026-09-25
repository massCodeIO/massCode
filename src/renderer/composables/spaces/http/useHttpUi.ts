const requestSettingsVersion = ref(0)
const dockOpen = ref(false)
const dockMaximized = ref(false)
const dockTab = ref<'console' | 'terminal'>('console')
const cookiesOpen = ref(false)
const environmentsOpen = ref(false)

watch(
  dockOpen,
  (open) => {
    if (!open)
      dockMaximized.value = false
  },
  { flush: 'sync' },
)

export function useHttpUi() {
  return {
    requestSettingsVersion,
    dockOpen,
    dockMaximized,
    dockTab,
    cookiesOpen,
    environmentsOpen,
  }
}
