<script setup lang="ts">
import type { CommunityThemesFilter } from '@/composables/useCommunityThemes'
import { Badge } from '@/components/ui/shadcn/badge'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { Input } from '@/components/ui/shadcn/input'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useCommunityThemes, useTheme } from '@/composables'
import { i18n, ipc } from '@/electron'
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  WifiOff,
} from 'lucide-vue-next'

const REGISTRY_CONTRIBUTE_URL
  = 'https://github.com/massCodeIO/masscode-themes/blob/main/CONTRIBUTING.md'

const { activeThemeId, customThemes } = useTheme()
const {
  filteredItems,
  isLoading,
  hasLoaded,
  source,
  isOfflineFallback,
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
} = useCommunityThemes()

const filterOptions: Array<{ id: CommunityThemesFilter, label: string }> = [
  { id: 'all', label: i18n.t('preferences:appearance.community.filters.all') },
  { id: 'dark', label: i18n.t('preferences:appearance.theme.dark') },
  { id: 'light', label: i18n.t('preferences:appearance.theme.light') },
  {
    id: 'installed',
    label: i18n.t('preferences:appearance.community.filters.installed'),
  },
]

const isConflictDialogOpen = computed({
  get: () => Boolean(pendingConflict.value),
  set: (open: boolean) => {
    if (!open) {
      cancelPendingConflict()
    }
  },
})

const conflictTitle = computed(() => {
  const conflict = pendingConflict.value
  if (!conflict) {
    return ''
  }

  if (conflict.action === 'uninstall') {
    return i18n.t('preferences:appearance.community.conflict.uninstallTitle')
  }

  return i18n.t('preferences:appearance.community.conflict.overwriteTitle')
})

const conflictDescription = computed(() => {
  const conflict = pendingConflict.value
  if (!conflict) {
    return ''
  }

  if (conflict.action === 'uninstall') {
    return i18n.t(
      'preferences:appearance.community.conflict.uninstallModifiedDescription',
      { name: conflict.themeName },
    )
  }

  if (conflict.reason === 'untracked-file') {
    return i18n.t(
      'preferences:appearance.community.conflict.untrackedDescription',
      { name: conflict.themeName },
    )
  }

  return i18n.t(
    'preferences:appearance.community.conflict.modifiedDescription',
    { name: conflict.themeName },
  )
})

const conflictConfirmLabel = computed(() => {
  const conflict = pendingConflict.value
  if (!conflict) {
    return ''
  }

  return conflict.action === 'uninstall'
    ? i18n.t('preferences:appearance.community.conflict.confirmDelete')
    : i18n.t('preferences:appearance.community.conflict.confirmOverwrite')
})

async function openRegistryRepo() {
  await ipc.invoke('system:open-external', REGISTRY_CONTRIBUTE_URL)
}

watch(
  () => customThemes.value,
  () => {
    if (hasLoaded.value && !isLoading.value) {
      void loadCatalog(false)
    }
  },
)

onMounted(() => {
  void loadCatalog(false)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="relative min-w-48 flex-1">
        <Search
          class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
        />
        <Input
          v-model="searchQuery"
          type="search"
          class="pl-8"
          :placeholder="
            i18n.t('preferences:appearance.community.searchPlaceholder')
          "
        />
      </div>

      <div class="flex items-center gap-1.5">
        <Tabs.Tabs v-model="filter">
          <Tabs.TabsList class="h-7">
            <Tabs.TabsTrigger
              v-for="option in filterOptions"
              :key="option.id"
              :value="option.id"
              class="h-6 px-2.5 text-xs"
            >
              {{ option.label }}
            </Tabs.TabsTrigger>
          </Tabs.TabsList>
        </Tabs.Tabs>

        <Button
          size="icon"
          variant="outline"
          class="h-7 w-7"
          :disabled="isLoading"
          :title="i18n.t('preferences:appearance.community.refresh')"
          :aria-label="i18n.t('preferences:appearance.community.refresh')"
          @click="loadCatalog(true)"
        >
          <RefreshCw
            class="h-3.5 w-3.5"
            :class="{ 'animate-spin': isLoading }"
          />
        </Button>
      </div>
    </div>

    <!-- Offline fallback notice (shown only on actual network error) -->
    <div
      v-if="isOfflineFallback && source === 'cache'"
      class="border-border bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
    >
      <div class="flex items-center gap-2">
        <WifiOff class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <UiText
          size="xs"
          muted
        >
          {{ i18n.t("preferences:appearance.community.offlineCached") }}
        </UiText>
      </div>
      <Badge
        variant="secondary"
        class="text-[10px]"
      >
        {{ i18n.t("preferences:appearance.community.offlineBadge") }}
      </Badge>
    </div>

    <!-- Loading initial -->
    <div
      v-if="isLoading && !hasLoaded"
      class="flex items-center justify-center gap-2 py-12"
    >
      <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
      <UiText
        size="sm"
        muted
      >
        {{ i18n.t("preferences:appearance.community.loading") }}
      </UiText>
    </div>

    <!-- Unavailable without cache & no installed themes -->
    <div
      v-else-if="source === 'unavailable' && filteredItems.length === 0"
      class="border-border flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center"
    >
      <WifiOff class="text-muted-foreground h-6 w-6" />
      <div class="flex flex-col items-center gap-1">
        <UiText
          size="sm"
          class="font-medium"
        >
          {{ i18n.t("preferences:appearance.community.unavailableTitle") }}
        </UiText>
        <UiText
          size="xs"
          muted
        >
          {{
            i18n.t("preferences:appearance.community.unavailableDescription")
          }}
        </UiText>
      </div>
      <Button
        size="sm"
        variant="outline"
        @click="loadCatalog(true)"
      >
        {{ i18n.t("preferences:appearance.community.retry") }}
      </Button>
    </div>

    <!-- Empty search / filter -->
    <div
      v-else-if="filteredItems.length === 0"
      class="border-border flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-10 text-center"
    >
      <UiText
        size="sm"
        muted
      >
        {{ i18n.t("preferences:appearance.community.empty") }}
      </UiText>
    </div>

    <!-- Theme cards grid -->
    <div
      v-else
      class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3"
    >
      <PreferencesThemesCommunityThemeCard
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :is-active="activeThemeId === item.id"
        :busy="isBusy(item.id)"
        @install="installTheme"
        @update="updateTheme"
        @apply="applyTheme"
        @uninstall="uninstallTheme"
      />
    </div>

    <!-- Footer submit CTA -->
    <div class="border-border flex items-center justify-between border-t pt-3">
      <UiText
        size="xs"
        muted
      >
        {{ i18n.t("preferences:appearance.community.submitHint") }}
      </UiText>
      <Button
        size="sm"
        variant="ghost"
        class="h-7 gap-1 text-xs"
        @click="openRegistryRepo"
      >
        {{ i18n.t("preferences:appearance.community.submitAction") }}
        <ExternalLink class="h-3 w-3" />
      </Button>
    </div>

    <!-- Conflict confirmation dialog -->
    <Dialog.Dialog v-model:open="isConflictDialogOpen">
      <Dialog.DialogContent
        @open-auto-focus="(e) => e.preventDefault()"
        @close-auto-focus="(e) => e.preventDefault()"
      >
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>{{ conflictTitle }}</Dialog.DialogTitle>
          <Dialog.DialogDescription>
            {{ conflictDescription }}
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>
        <Dialog.DialogFooter>
          <Button
            variant="outline"
            @click="cancelPendingConflict"
          >
            {{ i18n.t("preferences:appearance.community.conflict.cancel") }}
          </Button>
          <Button
            :variant="
              pendingConflict?.action === 'uninstall'
                ? 'destructive'
                : 'default'
            "
            @click="confirmPendingConflict"
          >
            {{ conflictConfirmLabel }}
          </Button>
        </Dialog.DialogFooter>
      </Dialog.DialogContent>
    </Dialog.Dialog>
  </div>
</template>
