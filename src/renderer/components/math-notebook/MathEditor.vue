<script setup lang="ts">
import { renderMathEditorHighlight } from './math-editor-highlight'

interface Props {
  modelValue: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'scroll', scrollTop: number): void
  (e: 'activeLine', line: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const textareaRef = ref<HTMLTextAreaElement>()
const activeLine = ref(0)
const scrollTop = ref(0)
const scrollLeft = ref(0)

const lineCount = computed(() => {
  return Math.max((props.modelValue || '').split('\n').length, 1)
})

const lineNumbers = computed(() => {
  return Array.from({ length: lineCount.value }, (_, i) => i + 1)
})

const highlightedHtml = computed(() => {
  return renderMathEditorHighlight(props.modelValue || '')
})

function syncScrollState(target: HTMLTextAreaElement) {
  scrollTop.value = target.scrollTop
  scrollLeft.value = target.scrollLeft
  emit('scroll', target.scrollTop)
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  updateActiveLine(target)
  syncScrollState(target)
}

function handleScroll(event: Event) {
  const target = event.target as HTMLTextAreaElement
  syncScrollState(target)
}

function updateActiveLine(target: HTMLTextAreaElement) {
  const text = target.value.substring(0, target.selectionStart)
  const line = text.split('\n').length - 1
  activeLine.value = line
  emit('activeLine', line)
}

function handleClick(event: Event) {
  updateActiveLine(event.target as HTMLTextAreaElement)
}

function handleKeyup(event: Event) {
  updateActiveLine(event.target as HTMLTextAreaElement)
}

onMounted(() => {
  textareaRef.value?.focus()
  if (textareaRef.value) {
    syncScrollState(textareaRef.value)
  }
})

const lineNumbersStyle = computed(() => {
  return {
    transform: `translate3d(0, ${-scrollTop.value}px, 0)`,
  }
})

const highlightStyle = computed(() => {
  return {
    transform: `translate3d(${-scrollLeft.value}px, ${-scrollTop.value}px, 0)`,
  }
})
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <div
      class="shrink-0 overflow-hidden border-r border-transparent py-1 pr-1 pl-3 text-right select-none"
    >
      <div
        class="will-change-transform"
        :style="lineNumbersStyle"
      >
        <div
          v-for="num in lineNumbers"
          :key="num"
          class="text-text-muted/40 h-[22px] font-mono text-[12px] leading-[22px] transition-colors duration-75"
          :class="{ '!text-text-muted': activeLine === num - 1 }"
        >
          {{ num }}
        </div>
      </div>
    </div>
    <div class="math-editor relative min-w-0 flex-1">
      <div
        aria-hidden="true"
        class="math-editor-highlight pointer-events-none absolute inset-0 overflow-hidden"
      >
        <pre
          class="min-h-full w-max min-w-full py-1 pr-4 pl-3 font-mono text-[13px] leading-[22px] tracking-wide whitespace-pre will-change-transform"
          :style="highlightStyle"
          v-html="highlightedHtml"
        />
      </div>
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="math-editor-textarea scrollbar selection:bg-list-selection absolute inset-0 h-full w-full resize-none bg-transparent py-1 pr-4 pl-3 font-mono text-[13px] leading-[22px] tracking-wide text-transparent outline-none"
        spellcheck="false"
        wrap="off"
        @input="handleInput"
        @scroll="handleScroll"
        @click="handleClick"
        @keyup="handleKeyup"
      />
    </div>
  </div>
</template>

<style scoped>
@reference '../../styles.css';

.math-editor {
  --math-editor-builtin: oklch(76% 0.17 285);
  --math-editor-keyword: oklch(68% 0.08 280);
  --math-editor-unit: oklch(78% 0.17 338);
  --math-editor-variable: oklch(78% 0.18 145);
}

:global(html:not(.dark)) .math-editor {
  --math-editor-builtin: oklch(56% 0.16 282);
  --math-editor-keyword: oklch(48% 0.05 280);
  --math-editor-unit: oklch(58% 0.16 335);
  --math-editor-variable: oklch(52% 0.17 145);
}

.math-editor-highlight {
  color: var(--color-text);
}

.math-editor-textarea {
  caret-color: var(--color-text);
}

.math-editor-highlight :deep(.mn-editor-token) {
  font-weight: 500;
}

.math-editor-highlight :deep(.mn-editor-token--variable) {
  color: var(--math-editor-variable);
}

.math-editor-highlight :deep(.mn-editor-token--builtin) {
  color: var(--math-editor-builtin);
}

.math-editor-highlight :deep(.mn-editor-token--unit) {
  color: var(--math-editor-unit);
}

.math-editor-highlight :deep(.mn-editor-token--keyword) {
  color: var(--math-editor-keyword);
}
</style>
