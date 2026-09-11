const requestSettingsVersion = ref(0)
const dockOpen = ref(false)
const dockTab = ref<'console' | 'terminal'>('console')
const cookiesOpen = ref(false)
const environmentsOpen = ref(false)

export function useHttpUi() {
  return {
    requestSettingsVersion,
    dockOpen,
    dockTab,
    cookiesOpen,
    environmentsOpen,
  }
}
