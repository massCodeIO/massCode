<script setup lang="ts">
import { useApp, useTheme } from '@/composables'
import { i18n, ipc } from '@/electron'
import { RouterName } from '@/router'
import { LoaderCircle } from 'lucide-vue-next'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { useRoute } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'
import { notifications } from './services/notifications'

const { isSponsored, isAppLoading } = useApp()
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

useTheme()

async function init() {
  registerIPCListeners()
  ipc.send('system:renderer-ready', null, () => {})
  loadWASM(onigasmFile)
  await loadGrammars()
  notifications()
}

init()
</script>

<template>
  <div
    data-title-bar
    class="absolute top-0 z-50 h-[var(--title-bar-height)] w-full select-none"
  />
  <div
    v-if="!isSponsored"
    class="text-text-muted absolute top-1 right-2 z-50 text-[11px] uppercase"
  >
    {{ i18n.t("messages:special.unsponsored") }}
  </div>
  <RouterView />
  <div
    v-if="isLoaderVisible"
    class="bg-bg absolute inset-0 z-50 flex flex-col items-center justify-center"
  >
    <template v-if="showLoader">
      {{ i18n.t("loading") }}
      <LoaderCircle class="text-text-muted mt-4 h-5 w-5 animate-spin" />
    </template>
  </div>
  <Toaster style="--width: 356px; --offset: 12px" />
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
