<script setup lang="ts">
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
const lineNumbersRef = ref<HTMLElement>()
const activeLine = ref(0)

const lineCount = computed(() => {
  return Math.max((props.modelValue || '').split('\n').length, 1)
})

const lineNumbers = computed(() => {
  return Array.from({ length: lineCount.value }, (_, i) => i + 1)
})

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  updateActiveLine(target)
}

function handleScroll(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('scroll', target.scrollTop)
  if (lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = target.scrollTop
  }
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
})
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <div
      ref="lineNumbersRef"
      class="shrink-0 overflow-hidden border-r border-transparent py-1 pr-1 pl-3 text-right select-none"
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
    <div class="relative min-w-0 flex-1">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="scrollbar absolute inset-0 h-full w-full resize-none bg-transparent py-1 pr-4 pl-3 font-mono text-[13px] leading-[22px] tracking-wide outline-none"
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
