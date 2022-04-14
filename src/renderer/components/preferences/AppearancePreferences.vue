<template>
  <div class="theme-preferences">
    <AppFormItem label="Theme">
      <AppSelect
        v-model="localValue"
        :options="options"
      />
    </AppFormItem>
  </div>
</template>

<script setup lang="ts">
import { track } from '@/electron'
import { useAppStore } from '@/store/app'
import type { Theme } from '@shared/types/renderer/store/app'
import { computed } from 'vue'

interface Options {
  label: string
  value: Theme
}

const appStore = useAppStore()

const localValue = computed({
  get: () => appStore.theme,
  set: v => {
    appStore.setTheme(v)
    track('app/set-theme', v)
  }
})

const options: Options[] = [
  { label: 'Light: Chrome', value: 'light:chrome' },
  { label: 'Light: Solarized', value: 'light:solarized' },
  { label: 'Light: TextMate', value: 'light:textmate' },
  { label: 'Light: Xcode', value: 'light:xcode' },
  { label: 'Dark: Dracula', value: 'dark:dracula' },
  { label: 'Dark: Merbivore', value: 'dark:merbivore' },
  { label: 'Dark: Monokai', value: 'dark:monokai' },
  { label: 'Dark: One Dark', value: 'dark:one' }
]
</script>

<style lang="scss" scoped></style>
