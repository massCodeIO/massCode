<script setup lang="ts">
import { useApp, useTheme } from '@/composables'
import { i18n, ipc } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { Toaster } from 'vue-sonner'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'
import { notifications } from './services/notifications'

const { isSponsored, isAppLoading } = useApp()

const showLoader = ref(false)
let loaderTimer: ReturnType<typeof setTimeout> | null = null

loaderTimer = setTimeout(() => {
  showLoader.value = true
}, 300)

watch(isAppLoading, (value) => {
  if (!value) {
    clearTimeout(loaderTimer!)
    showLoader.value = false
  }
})

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
    v-if="isAppLoading"
    class="bg-bg absolute inset-0 z-50 flex flex-col items-center justify-center"
  >
    <template v-if="showLoader">
      App loading...
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
