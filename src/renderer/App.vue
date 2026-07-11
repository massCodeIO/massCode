<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import {
  useActivityTracker,
  useApp,
  useCopyTracker,
  useDonationTriggers,
  useSonner,
  useTheme,
  useVaultDoctor,
  VAULT_DOCTOR_NOTICE_ID,
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
    closeButton: true,
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

// Неблокирующая проверка vault после загрузки приложения. Doctor живёт в
// Storage settings, куда пользователь почти не заходит, поэтому о конфликтах
// синхронизации (дубли id, merge-маркеры, битый frontmatter) сообщаем
// проактивно. Safe fixes сюда не входят — их watcher применяет молча.
function checkVaultHealth() {
  const { sonner } = useSonner()
  const { scan } = useVaultDoctor()

  // Startup-скан почти всегда стартует раньше конца фоновой сверки vault:
  // на notReady проверка повторяется по событию синхронизации, иначе
  // проблемный vault выглядел бы чистым до ручного скана. Fallback-таймер
  // страхует от потерянного события: storage-synced может прийти, пока
  // предыдущий scan ещё выполняется, и его перезапуск ничего не даст.
  //
  // Подписка на storage-synced ставится ОДИН раз и не снимается:
  // contextBridge оборачивает функцию в новый прокси при каждой передаче,
  // и ipc.removeListener по ссылке не срабатывает — динамическая
  // add/remove-подписка накапливала бы обработчики на каждый event
  // (см. комментарий у Editor.vue про removeListeners).
  const VAULT_HEALTH_RETRY_FALLBACK_MS = 15_000
  let retryFallbackTimer: ReturnType<typeof setTimeout> | undefined
  let isResolved = false
  let isRunning = false

  const scheduleRetryFallback = () => {
    if (retryFallbackTimer) {
      clearTimeout(retryFallbackTimer)
    }

    retryFallbackTimer = setTimeout(() => {
      retryFallbackTimer = undefined
      void run()
    }, VAULT_HEALTH_RETRY_FALLBACK_MS)
  }

  const clearRetryFallback = () => {
    if (retryFallbackTimer) {
      clearTimeout(retryFallbackTimer)
      retryFallbackTimer = undefined
    }
  }

  ipc.on('system:storage-synced', () => {
    void run()
  })

  async function run() {
    if (isResolved || isRunning) {
      return
    }

    isRunning = true
    try {
      const data = await scan()
      if (!data || data.notReady) {
        // Постоянный listener и fallback-таймер гарантируют повтор.
        scheduleRetryFallback()
        return
      }

      isResolved = true
      clearRetryFallback()

      if (data.summary.conflicts === 0) {
        return
      }

      sonner({
        id: VAULT_DOCTOR_NOTICE_ID,
        message: i18n.t('messages:warning.vaultDoctorConflicts', {
          count: data.summary.conflicts,
        }),
        type: 'warning',
        closeButton: true,
        action: {
          label: i18n.t('messages:warning.vaultDoctorReview'),
          onClick: () => {
            router.push({
              name: RouterName.preferencesStorage,
              query: { doctor: 'scan' },
            })
          },
        },
      })
    }
    catch {
      // Health check не критичен: транзиентная ошибка не показывается, но
      // повтор перепланируется — события storage-synced могли уже отгреметь.
      scheduleRetryFallback()
    }
    finally {
      isRunning = false
    }
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => run(), { timeout: 5000 })
  }
  else {
    setTimeout(run, 2000)
  }
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
  checkVaultHealth()
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
