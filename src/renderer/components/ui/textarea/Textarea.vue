<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { variants } from './variants'

interface Props {
  variant?: Variants['variant']
  class?: string
  placeholder?: string
  focus?: boolean
  scrollbarOptions?: any
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
  <div class="relative">
    <PerfectScrollbar
      :options="scrollbarOptions"
      class="max-h-[100px]"
    >
      <div
        ref="inputRef"
        :class="[cn(variants({ variant }), props.class)]"
        class="break-words whitespace-pre-wrap"
        contenteditable="true"
        spellcheck="false"
        role="textbox"
        :data-placeholder="placeholder"
        @blur="onBlur"
      >
        {{ model }}
      </div>
    </PerfectScrollbar>
  </div>
</template>
