<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import type { NodeData } from './types'
import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { useTheme } from '@/composables'
import { json } from '@codemirror/lang-json'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { useClipboard } from '@vueuse/core'
import { Copy } from 'lucide-vue-next'

interface Props {
  node: Node<NodeData>
}

const props = defineProps<Props>()

const { copy } = useClipboard()
const { isDark } = useTheme()
let editor: EditorView | null = null
const editorRef = useTemplateRef('editorRef')
const theme = new Compartment()
function toJsonString(value: unknown) {
  return JSON.stringify(value, null, 2) || '{}'
}
function init() {
  if (!editorRef.value)
    return
  editor = new EditorView({
    parent: editorRef.value,
    state: EditorState.create({
      doc: toJsonString(props.node.data?.value),
      extensions: [
        json(),
        lineNumbers(),
        EditorView.lineWrapping,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        theme.of(createCodeHighlight(isDark.value)),
      ],
    }),
  })
}
watch(
  () => props.node,
  () => {
    if (editor) {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: toJsonString(props.node.data?.value),
        },
      })
    }
  },
  { deep: true },
)
watch(isDark, () =>
  editor?.dispatch({
    effects: theme.reconfigure(createCodeHighlight(isDark.value)),
  }))
onBeforeUnmount(() => editor?.destroy())

function onCopy() {
  copy(editor?.state.doc.toString() || '')
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
  --dialog-info-bg: oklch(98% 0 0);
}

html.dark [data-dialog-info] {
  --dialog-info-bg: oklch(22% 0 0);
}

[data-dialog-info] .cm-editor {
  background: var(--dialog-info-bg) !important;
}

[data-dialog-info] .cm-gutters {
  background: var(--dialog-info-bg) !important;
}
[data-dialog-info] .cm-editor {
  height: 100%;
}
[data-dialog-info] .cm-scroller {
  overflow: auto;
}
</style>
