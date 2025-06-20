<script setup lang="ts">
import { useApp, useNotifications, useTheme } from '@/composables'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { Toaster } from 'vue-sonner'
import { loadGrammars } from './components/editor/grammars'
import { registerIPCListeners } from './ipc'

useApp()
useTheme()
useNotifications()

async function init() {
  registerIPCListeners()
  loadWASM(onigasmFile)
  await loadGrammars()
}

init()
</script>

<template>
  <div
    data-title-bar
    class="absolute top-0 z-50 h-[var(--title-bar-height)] w-full select-none"
  />
  <RouterView />
  <Toaster style="--width: 356px; --offset: 12px" />
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
