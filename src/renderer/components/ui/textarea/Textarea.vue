<script setup lang="ts">
import type { Variants } from './variants'
import { ScrollArea } from '@/components/ui/shadcn/scroll-area'
import { cn } from '@/utils'
import { variants } from './variants'

interface Props {
  variant?: Variants['variant']
  class?: string
  placeholder?: string
  focus?: boolean
}

const props = defineProps<Props>()

const model = defineModel<string>()

const inputRef = useTemplateRef('inputRef')

function onBlur(e: FocusEvent) {
  const target = e.target as HTMLDivElement
  // eslint-disable-next-line unicorn/prefer-dom-node-text-content
  model.value = target.innerText.trimEnd()
}

watchEffect(() => {
  if (props.focus) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})
</script>

<template>
  <ScrollArea>
    <div
      ref="inputRef"
      :class="[cn(variants({ variant }), props.class)]"
      contenteditable="true"
      spellcheck="false"
      :data-placeholder="placeholder"
      @blur="onBlur"
    >
      {{ model }}
    </div>
  </ScrollArea>
</template>

<style>
div[contenteditable="true"]:empty:before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}
</style>
