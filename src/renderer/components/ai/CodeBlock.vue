<script setup lang="ts">
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useTheme } from '@/composables/useTheme'
import { i18n } from '@/electron'
import { Copy } from 'lucide-vue-next'
import { escapeCode, highlightCode } from './highlight'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

const props = defineProps<{ code: string, language: string }>()
const copy = useCopyToClipboard()
const { editorThemeName } = useTheme()
const themeClasses = computed(() =>
  editorThemeName.value.split(/\s+/).map(name => `cm-s-${name}`),
)
const html = ref('')
watch(
  () => [props.code, props.language],
  async (_value, _old, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    html.value = escapeCode(props.code)
    const highlighted = await highlightCode(props.code, props.language)
    if (!stale)
      html.value = highlighted
  },
  { immediate: true },
)
</script>

<template>
  <div class="bg-muted my-2 overflow-hidden rounded-md border">
    <div class="flex items-center justify-between border-b px-3 py-1">
      <UiText
        variant="xs"
        muted
      >
        {{ language }}
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('action.copy')"
        @click="copy(code)"
      >
        <Copy class="size-3" />
      </UiActionButton>
    </div>
    <pre
      :class="themeClasses"
      class="scrollbar overflow-x-auto p-3"
    ><code v-html="html" /></pre>
  </div>
</template>
