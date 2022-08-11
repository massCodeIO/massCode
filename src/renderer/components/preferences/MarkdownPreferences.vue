<template>
  <div class="language-preferences">
    <AppForm>
      <AppFormItem :label="i18n.t('preferences:markdown.codeRenderer')">
        <AppSelect
          v-model="renderer"
          :options="rendererOptions"
        />
        <template #desc>
          {{ i18n.t('special:description.codeBlockRenderer.0') }}
          <a
            href="#"
            @click="
              onClickUrl(
                'https://github.com/massCodeIO/massCode/blob/master/src/renderer/components/editor/languages.ts'
              )
            "
          >{{ i18n.t('special:description.codeBlockRenderer.1') }}</a>.
        </template>
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { i18n, store } from '@/electron'
import { useAppStore } from '@/store/app'
import { computed } from 'vue'
import { onClickUrl } from '@/composable'

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
