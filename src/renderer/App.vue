<script setup lang="ts">
import { useApp } from '@/composables'
import { useDark } from '@vueuse/core'
import { loadWASM } from 'onigasm'
import onigasmFile from 'onigasm/lib/onigasm.wasm?url'
import { loadGrammars } from './components/editor/grammars'
import { subscribe } from './ipc'

useApp()
useDark()

async function init() {
  loadWASM(onigasmFile)
  await loadGrammars()
}

init()
subscribe()
</script>

<template>
  <div
    data-title-bar
    class="absolute top-0 z-50 h-[var(--title-bar-height)] w-full select-none"
  />
  <RouterView />
</template>

<style>
[data-title-bar] {
  -webkit-app-region: drag;
}
</style>
