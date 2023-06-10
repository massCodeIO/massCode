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
import { i18n } from '@/electron'
import { track } from '@/services/analytics'
import { useAppStore } from '@/store/app'
import type { Theme } from '@shared/types/renderer/store/app'
import { computed } from 'vue'
import { themes } from '@/components/editor/themes'

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

const options: Options[] = themes
  .map(i => {
    const label = i.value.startsWith('light')
      ? `${i18n.t('preferences:appearance.theme.light')}: ${i.label}`
      : `${i18n.t('preferences:appearance.theme.dark')}: ${i.label}`

    return {
      label,
      value: i.value
    }
  })
  .sort((a, b) => (a.label > b.label ? 1 : -1))
</script>

<style lang="scss" scoped></style>
