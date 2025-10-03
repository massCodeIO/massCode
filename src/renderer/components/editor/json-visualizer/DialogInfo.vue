<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import type { NodeData } from './types'
import { useClipboard, useDark, useDebounceFn } from '@vueuse/core'
import CodeMirror from 'codemirror'
import { Copy } from 'lucide-vue-next'
import { onMounted, watch } from 'vue'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'

interface Props {
  node: Node<NodeData>
}

const props = defineProps<Props>()

const { copy } = useClipboard()
const isDark = useDark()

let editor: CodeMirror.Editor | null = null
const editorRef = useTemplateRef('editorRef')

const scrollBarOpacity = ref('1')
const theme = computed(() => (isDark.value ? 'oceanic-next' : 'neo'))

const hideScrollbar = useDebounceFn(() => {
  scrollBarOpacity.value = '0'
}, 1000)

function toJsonString(value: any) {
  return JSON.stringify(value, null, 2) || '{}'
}

function init() {
  if (!editorRef.value) {
    return
  }

  editor = CodeMirror(editorRef.value, {
    value: toJsonString(props.node.data?.value),
    mode: 'json',
    lineNumbers: true,
    theme: theme.value,
    readOnly: true,
    lineWrapping: true,
    scrollbarStyle: 'null',
  })

  editor.on('scroll', () => {
    scrollBarOpacity.value = '1'
    editor?.setOption('scrollbarStyle', 'overlay')
  })

  editor.on('scroll', hideScrollbar)

  watch(
    () => props.node,
    (newNode) => {
      if (editor && newNode.data?.value !== undefined) {
        const jsonString = toJsonString(newNode.data.value)
        editor.setValue(jsonString)
      }
    },
    { deep: true },
  )

  watch(isDark, (v) => {
    if (v) {
      editor?.setOption('theme', 'oceanic-next')
    }
    else {
      editor?.setOption('theme', 'neo')
    }
  })
}

function onCopy() {
  copy(editor?.getValue() || '')
  editorRef.value?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  )
}

onMounted(() => {
  init()
})
</script>

<template>
  <div class="relative">
    <UiActionButton
      class="absolute top-1 right-1 z-10"
      @click="onCopy"
    >
      <Copy class="h-3 w-3" />
    </UiActionButton>
    <div
      ref="editorRef"
      data-dialog-info
      class="h-[200px] overflow-auto rounded-md"
    />
  </div>
</template>

<style>
html.light [data-dialog-info] {
  --color-bg: oklch(98% 0 0);
}

html.dark [data-dialog-info] {
  --color-bg: oklch(22% 0 0);
}

[data-dialog-info] .CodeMirror {
  background: var(--color-bg) !important;
}

[data-dialog-info] .CodeMirror-gutters {
  background: var(--color-bg) !important;
}
</style>
