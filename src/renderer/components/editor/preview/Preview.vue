<script setup lang="ts">
import { useSnippets } from '@/composables'
import { i18n, ipc } from '@/electron'
import { useDark } from '@vueuse/core'
import { FileDown, Moon, RefreshCcw, Sun } from 'lucide-vue-next'

const { selectedSnippet } = useSnippets()

const previewKey = ref(0)

const isDark = useDark()

const isDarkPreview = ref(isDark.value)

const defaultHtml = computed(() => {
  return `<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 14px;">
    <p style="color: ${isDarkPreview.value ? 'oklch(75% 0 0)' : 'oklch(20% 0 0)'}; text-align: center;">${i18n.t('messages:warning.htmlCssPreview')}</p>
  </div>`
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

function generateHtmlPreview(save = false) {
  const cssDefault = `
    body {
      background-color: ${isDarkPreview.value ? 'oklch(24.78% 0 0)' : 'oklch(100% 0 0)'};
    }
  `

  const jsDefault = `
    try {
      ${js.value}
    } catch (error) {
      console.error('Error in preview:', error)
    }
  `

  const cssCode = save ? css.value : cssDefault + css.value
  const jsCode = save ? js.value : jsDefault

  return `<!DOCTYPE html>
    <html>
      <head>
        <style>${cssCode}</style>
      </head>
      <body>
        ${html.value}
        <script>${jsCode}<\/script>
      </body>
    </html>
  `
}

const htmlPreview = computed(() => generateHtmlPreview())

async function onSaveHtml() {
  let html = generateHtmlPreview(true)

  try {
    html = await ipc.invoke('prettier:format', {
      text: html,
      parser: 'html',
    })
  }
  catch (error) {
    console.error(error)
  }

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = `${selectedSnippet.value?.name}.html`
  a.click()
}
watch([html, css, js], () => {
  previewKey.value++
})

watch(isDarkPreview, () => {
  previewKey.value++
})
</script>

<template>
  <div
    class="border-border flex h-[var(--editor-tool-header-height)] items-center justify-between border-b px-2 py-1"
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
    <div class="flex items-center">
      <UiActionButton
        type="iconText"
        :tooltip="`${i18n.t('button.saveAs')} HTML`"
        @click="onSaveHtml"
      >
        <div class="flex items-center gap-1">
          HTML <FileDown class="h-3 w-3" />
        </div>
      </UiActionButton>
      <UiActionButton
        type="icon"
        :tooltip="i18n.t('button.refreshPreview')"
        @click="previewKey++"
      >
        <RefreshCcw class="h-3 w-3" />
      </UiActionButton>
    </div>
  </div>
  <div class="h-[calc(100%-var(--editor-tool-header-height))]">
    <iframe
      :key="previewKey"
      data-editor-preview
      :srcdoc="htmlPreview"
      sandbox="allow-scripts"
      frameborder="0"
      height="100%"
      width="100%"
    />
  </div>
</template>
