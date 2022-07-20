<template>
  <div class="theme-preferences">
    <AppFormItem :label="i18n.t('preferences:appearance.theme.label')">
      <AppSelect
        v-model="localValue"
        :options="options"
      />
    </AppFormItem>
  </div>
</template>

<script setup lang="ts">
import { track, i18n } from '@/electron'
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
  {
    label: `${i18n.t('preferences:appearance.theme.light')}: Chrome`,
    value: 'light:chrome'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.light')}: Solarized`,
    value: 'light:solarized'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.light')}: TextMate`,
    value: 'light:textmate'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.light')}: Xcode`,
    value: 'light:xcode'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.dark')}: Dracula`,
    value: 'dark:dracula'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.dark')}: Merbivore`,
    value: 'dark:merbivore'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.dark')}: Monokai`,
    value: 'dark:monokai'
  },
  {
    label: `${i18n.t('preferences:appearance.theme.dark')}: One Dark`,
    value: 'dark:one'
  }
]
</script>

<style lang="scss" scoped></style>
