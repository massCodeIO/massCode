<template>
  <div class="app-title-bar" />
  <RouterView />
</template>

<script setup lang="ts">
import router from '@/router'
import { watch } from 'vue'
import { ipc } from './electron'
import { useAppStore } from './store/app'

// По какой то причине необходимо явно установить роут в '/'
// для корректного поведения в продакшен сборке
// TODO: выяснить причину
router.push('/')

const appStore = useAppStore()

const setTheme = (theme: string) => {
  document.body.dataset.theme = theme
}

watch(
  () => appStore.theme,
  () => setTheme(appStore.theme),
  { immediate: true }
)

ipc.on('main-menu:preferences', () => {
  router.push('/preferences')
})
</script>

<style lang="scss">
body {
  margin: 0;
}
.app {
  &-title-bar {
    position: absolute;
    top: 0;
    width: 100%;
    height: var(--title-bar-height);
    user-select: none;
    -webkit-app-region: drag;
    z-index: 1010;
    transition: all 0.5s;
  }
}
</style>
