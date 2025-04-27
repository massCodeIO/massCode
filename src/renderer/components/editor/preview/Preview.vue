<script setup lang="ts">
import { useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { useDark } from '@vueuse/core'
import { Moon, RefreshCcw, Sun } from 'lucide-vue-next'

const { selectedSnippet } = useSnippets()

const previewKey = ref(0)

const isDark = useDark()

const isDarkPreview = ref(isDark.value)

const defaultHtml = computed(() => {
  return `<p style="color: ${isDarkPreview.value ? '#fff' : '#000'}; text-align: center;">${i18n.t('messages:warning.htmlCssPreview')}</p>`
})

const html = computed(() => {
  return (
    selectedSnippet.value?.contents.find(
      content => content.language === 'html',
    )?.value || defaultHtml.value
  )
})

const css = computed(() => {
  return (
    selectedSnippet.value?.contents.find(
      content => content.language === 'css',
    )?.value || ''
  )
})

const js = computed(() => {
  return (
    selectedSnippet.value?.contents.find(
      content => content.language === 'javascript',
    )?.value || ''
  )
})

const htmlPreview = computed(() => {
  const cssDefault = `
    body {
      background-color: ${isDarkPreview.value ? 'oklch(24.78% 0 0)' : 'oklch(100% 0 0)'};
    }
  }
  `
  return `<!DOCTYPE html>
    <html ${isDarkPreview.value ? 'class="dark"' : ''}>
      <head>
        <style>${cssDefault}</style>
        <style>${css.value}</style>
      </head>
      <body class="h-full w-full">
        ${html.value}
        <script>
          try {
            ${js.value}
          } catch (error) {
            console.error('Error in preview:', error)
          }
        <\/script>
      </body>
    </html>
  `
})

watch([html, css, js], () => {
  previewKey.value++
})

watch(isDarkPreview, () => {
  previewKey.value++
})
</script>

<template>
  <div
    class="border-border flex items-center justify-between border-b px-2 py-1"
  >
    <div>
      <UiActionButton
        type="icon"
        :tooltip="i18n.t('button.toggleDarkMode')"
        @click="isDarkPreview = !isDarkPreview"
      >
        <Moon
          v-if="isDarkPreview"
          class="h-3 w-3"
        />
        <Sun
          v-else
          class="h-3 w-3"
        />
      </UiActionButton>
    </div>
    <div>
      <UiActionButton
        type="icon"
        :tooltip="i18n.t('button.refreshPreview')"
        @click="previewKey++"
      >
        <RefreshCcw class="h-3 w-3" />
      </UiActionButton>
    </div>
  </div>
  <iframe
    :key="previewKey"
    data-editor-preview
    :srcdoc="htmlPreview"
    sandbox="allow-scripts"
    frameborder="0"
    height="100%"
    width="100%"
  />
</template>
