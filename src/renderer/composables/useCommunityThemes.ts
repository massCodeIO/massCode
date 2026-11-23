import type {
  CommunityThemeConflictReason,
  CommunityThemeInstallPayload,
  CommunityThemeInstallResult,
  CommunityThemeItem,
  CommunityThemeListPayload,
  CommunityThemesCatalogResult,
  CommunityThemesSource,
  CommunityThemeUninstallPayload,
  CommunityThemeUninstallResult,
} from '~/main/store/types/theme'
import { useSonner } from '@/composables/useSonner'
import { useTheme } from '@/composables/useTheme'
import { i18n, ipc } from '@/electron'

export type CommunityThemesFilter = 'all' | 'dark' | 'light' | 'installed'

export interface PendingThemeConflict {
  action: 'install' | 'update' | 'uninstall'
  themeId: string
  themeName: string
  reason: CommunityThemeConflictReason
  localSha256?: string
}

const items = ref<CommunityThemeItem[]>([])
const isLoading = ref(false)
const hasLoaded = ref(false)
const source = ref<CommunityThemesSource>('unavailable')
const isOfflineFallback = ref(false)
const errorMessage = ref<string | null>(null)
const searchQuery = ref('')
const filter = ref<CommunityThemesFilter>('all')
const busyIds = ref<Set<string>>(new Set())
const pendingConflict = ref<PendingThemeConflict | null>(null)

function setBusy(id: string, busy: boolean): void {
  const next = new Set(busyIds.value)
  if (busy) {
    next.add(id)
  }
  else {
    next.delete(id)
  }
  busyIds.value = next
}

function isBusy(id: string): boolean {
  return busyIds.value.has(id)
}

export function useCommunityThemes() {
  const { currentThemeId, activeThemeId, loadCustomThemes, setTheme }
    = useTheme()
  const { sonner } = useSonner()

  const filteredItems = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()

    return items.value.filter((item) => {
      if (filter.value === 'dark' && item.type !== 'dark') {
        return false
      }
      if (filter.value === 'light' && item.type !== 'light') {
        return false
      }
      if (filter.value === 'installed' && item.status === 'available') {
        return false
      }

      if (!query) {
        return true
      }

      const inName = item.name.toLowerCase().includes(query)
      const inAuthor = item.author?.toLowerCase().includes(query) ?? false
      const inId = item.id.toLowerCase().includes(query)

      return inName || inAuthor || inId
    })
  })

  async function loadCatalog(forceRefresh = false): Promise<void> {
    if (isLoading.value) {
      return
    }

    isLoading.value = true
    errorMessage.value = null

    try {
      const result = await ipc.invoke<
        CommunityThemeListPayload,
        CommunityThemesCatalogResult
      >('theme:community-list', { forceRefresh })

      items.value = result.items
      source.value = result.source
      isOfflineFallback.value = result.isOfflineFallback
      errorMessage.value = result.error ?? null
      hasLoaded.value = true
    }
    catch (error) {
      errorMessage.value
        = error instanceof Error ? error.message : String(error)
      source.value = 'unavailable'
      isOfflineFallback.value = true
    }
    finally {
      isLoading.value = false
    }
  }

  async function performInstallOrUpdate(
    item: CommunityThemeItem,
    mode: 'install' | 'update',
    expectedLocalSha256?: string,
  ): Promise<void> {
    if (isBusy(item.id)) {
      return
    }

    setBusy(item.id, true)

    try {
      const result = await ipc.invoke<
        CommunityThemeInstallPayload,
        CommunityThemeInstallResult
      >('theme:community-install', {
        id: item.id,
        ...(expectedLocalSha256 !== undefined ? { expectedLocalSha256 } : {}),
      })

      if (result.status === 'conflict') {
        pendingConflict.value = {
          action: mode,
          themeId: item.id,
          themeName: item.name,
          reason: result.reason ?? 'locally-modified',
          localSha256: result.localSha256,
        }
        return
      }

      await loadCustomThemes()

      if (mode === 'install') {
        await setTheme(item.id)
        sonner({
          message: i18n.t('preferences:appearance.community.installedToast', {
            name: item.name,
          }),
          type: 'success',
        })
      }
      else {
        // Preserve active theme (and system mode) if updating an inactive theme
        const resolvedActiveId = activeThemeId?.value ?? currentThemeId.value
        if (resolvedActiveId === item.id) {
          await setTheme(currentThemeId.value)
        }
        sonner({
          message: i18n.t('preferences:appearance.community.updatedToast', {
            name: item.name,
          }),
          type: 'success',
        })
      }

      await loadCatalog(false)
    }
    catch {
      sonner({
        message: i18n.t(
          mode === 'install'
            ? 'preferences:appearance.community.installError'
            : 'preferences:appearance.community.updateError',
        ),
        type: 'error',
      })
    }
    finally {
      setBusy(item.id, false)
    }
  }

  async function installTheme(
    item: CommunityThemeItem,
    expectedLocalSha256?: string,
  ): Promise<void> {
    await performInstallOrUpdate(item, 'install', expectedLocalSha256)
  }

  async function updateTheme(
    item: CommunityThemeItem,
    expectedLocalSha256?: string,
  ): Promise<void> {
    await performInstallOrUpdate(item, 'update', expectedLocalSha256)
  }

  async function uninstallTheme(
    item: CommunityThemeItem,
    expectedLocalSha256?: string,
  ): Promise<void> {
    if (isBusy(item.id)) {
      return
    }

    setBusy(item.id, true)

    try {
      const result = await ipc.invoke<
        CommunityThemeUninstallPayload,
        CommunityThemeUninstallResult
      >('theme:community-uninstall', {
        id: item.id,
        ...(expectedLocalSha256 !== undefined ? { expectedLocalSha256 } : {}),
      })

      if (result.status === 'conflict') {
        pendingConflict.value = {
          action: 'uninstall',
          themeId: item.id,
          themeName: item.name,
          reason: result.reason ?? 'locally-modified',
          localSha256: result.localSha256,
        }
        return
      }

      if (result.status === 'not-managed') {
        sonner({
          message: i18n.t('preferences:appearance.community.unmanagedError'),
          type: 'warning',
        })
        return
      }

      await loadCustomThemes()
      await loadCatalog(false)
      sonner({
        message: i18n.t('preferences:appearance.community.uninstalledToast', {
          name: item.name,
        }),
        type: 'success',
      })
    }
    catch {
      sonner({
        message: i18n.t('preferences:appearance.community.uninstallError'),
        type: 'error',
      })
    }
    finally {
      setBusy(item.id, false)
    }
  }

  async function confirmPendingConflict(): Promise<void> {
    const conflict = pendingConflict.value
    if (!conflict) {
      return
    }

    const item = items.value.find(entry => entry.id === conflict.themeId)
    pendingConflict.value = null

    if (!item) {
      return
    }

    if (conflict.action === 'install') {
      await installTheme(item, conflict.localSha256)
    }
    else if (conflict.action === 'update') {
      await updateTheme(item, conflict.localSha256)
    }
    else {
      await uninstallTheme(item, conflict.localSha256)
    }
  }

  function cancelPendingConflict(): void {
    pendingConflict.value = null
  }

  async function applyTheme(id: string): Promise<void> {
    await setTheme(id)
  }

  return {
    items,
    filteredItems,
    isLoading,
    hasLoaded,
    source,
    isOfflineFallback,
    errorMessage,
    searchQuery,
    filter,
    pendingConflict,
    isBusy,
    loadCatalog,
    installTheme,
    updateTheme,
    uninstallTheme,
    confirmPendingConflict,
    cancelPendingConflict,
    applyTheme,
  }
}
