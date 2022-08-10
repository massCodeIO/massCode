<template>
  <div class="language-preferences">
    <AppForm>
      <AppFormItem :label="i18n.t('preferences:markdown.codeRenderer')">
        <AppSelect
          v-model="renderer"
          :options="rendererOptions"
        />
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { i18n, store } from '@/electron'
import { useAppStore } from '@/store/app'
import { computed } from 'vue'

const appStore = useAppStore()

const renderer = computed({
  get: () => appStore.markdown.codeRenderer,
  set: v => {
    appStore.markdown.codeRenderer = v
    store.preferences.set('markdown', { ...appStore.markdown })
  }
})

const rendererOptions = [
  {
    label: 'Codemirror',
    value: 'codemirror'
  },
  {
    label: 'Highlight.js',
    value: 'highlight.js'
  }
]
</script>

<style lang="scss" scoped></style>
