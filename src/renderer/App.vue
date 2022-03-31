<template>
  <div data-theme="light">
    <div class="app-title-bar" />
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import router from '@/router'

// По какой то причине необходимо явно установить роут в '/'
// для корректного поведения в продакшен сборке
// TODO: выяснить причину
router.push('/')
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
