<script setup lang="ts">
import { useEditor, useSnippets } from '@/composables'

const { cursorPosition } = useEditor()
const { selectedSnippetContent } = useSnippets()
</script>

<template>
  <div
    data-editor-footer
    class="border-border flex items-center justify-between border-t px-2 py-1 text-xs"
  >
    <div>
      {{ selectedSnippetContent?.language }}
    </div>
    <div>
      Ln {{ cursorPosition.row + 1 }}, Col {{ cursorPosition.column + 1 }}
    </div>
  </div>
</template>
