<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import {
  useActivityTracker,
  useApp,
  useCopyTracker,
  useDonationTriggers,
  useSonner,
  useTheme,
} from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { router, RouterName } from '@/router'
import { getSpaceDefinitions, isSpaceRouteName } from '@/spaceDefinitions'
import { isMac } from '@/utils'
import { LoaderCircle } from 'lucide-vue-next'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { repository, version } from '../../package.json'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'

const { isAppLoading, isSponsored } = useApp()
const route = useRoute()

const showLoader = ref(false)

const isMainRoute = computed(() => route.name === RouterName.main)
const isLoaderVisible = computed(() => isMainRoute.value && isAppLoading.value)

watch(
  isLoaderVisible,
  (value) => {
    if (!value) {
      showLoader.value = false
      return
    }

    const timer = setTimeout(() => {
      showLoader.value = true
    }, 300)

    onWatcherCleanup(() => clearTimeout(timer))
  },
  { immediate: true },
)

watch(
  isMainRoute,
  (value) => {
    if (!value) {
      isAppLoading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => route.name,
  (routeName) => {
    if (
      routeName === RouterName.notesSpace
      || routeName === RouterName.notesDashboard
      || routeName === RouterName.notesGraph
    ) {
      store.app.set('notes.route', routeName)
    }
  },
  { immediate: true },
)

useTheme()

// Одноразовый тост после смены версии приложения; контент живёт в release notes.
function showWhatsNewOnce() {
  if (store.app.get('notifications.lastWhatsNewVersion') === version) {
    return
  }

  store.app.set('notifications.lastWhatsNewVersion', version)

  const { sonner } = useSonner()

  sonner({
    message: i18n.t('messages:update.whatsNewToast', { version }),
    type: 'success',
    action: {
      label: i18n.t('messages:update.releaseNotes'),
      onClick: () => {
        ipc.invoke(
          'system:open-external',
          `${repository}/releases/tag/v${version}`,
        )
      },
    },
  })
}

function restoreSavedSpace() {
  const savedSpaceId = store.app.get<string>('activeSpaceId')
  if (savedSpaceId && savedSpaceId !== 'code') {
    const space = getSpaceDefinitions().find(s => s.id === savedSpaceId)
    if (space) {
      router.replace(space.to)
    }
  }
}

async function init() {
  registerIPCListeners()
  ipc.send('system:renderer-ready', null, () => {})
  restoreSavedSpace()
  loadWASM(onigasmFile)
  await loadGrammars()
  useActivityTracker()
  useCopyTracker()
  if (!isSponsored.value) {
    useDonationTriggers()
  }
  showWhatsNewOnce()
}

init()
</script>

<template>
  <Tooltip.TooltipProvider>
    <div
      v-if="isMac"
      data-title-bar
      class="absolute top-0 z-50 h-3 w-full select-none"
    />
    <RouterView v-slot="{ Component, route: currentRoute }">
      <AppSpaceShell
        v-if="isSpaceRouteName(currentRoute.name)"
        :show-rail="currentRoute.name !== RouterName.notesPresentation"
      >
        <component :is="Component" />
      </AppSpaceShell>
      <component
        :is="Component"
        v-else
      />
    </RouterView>
    <ImportsImportDialog />
    <CommandPalette />
    <div
      v-if="isLoaderVisible"
      class="bg-background absolute inset-0 z-50 flex flex-col items-center justify-center"
    >
      <template v-if="showLoader">
        {{ i18n.t("loading") }}
        <LoaderCircle class="text-muted-foreground mt-4 h-5 w-5 animate-spin" />
      </template>
    </div>
    <Toaster style="--width: 356px; --offset: 12px" />
  </Tooltip.TooltipProvider>
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
