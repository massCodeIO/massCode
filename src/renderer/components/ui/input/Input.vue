<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { X } from 'lucide-vue-next'
import { variants } from './variants'

interface Props {
  variant?: Variants['variant']
  class?: string
  placeholder?: string
  clearable?: boolean
  type?: 'text' | 'textarea' | 'number'
  focus?: boolean
  select?: boolean
  disabled?: boolean
  readonly?: boolean
  rows?: number
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
})

const attrs = useAttrs()

const model = defineModel<string | number>()

function clear() {
  model.value = ''
}

const inputRef = useTemplateRef('inputRef')

watchEffect(() => {
  if (props.focus) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

watchEffect(() => {
  if (props.select) {
    nextTick(() => {
      inputRef.value?.select()
    })
  }
})
</script>

<template>
  <div class="relative flex">
    <input
      v-if="type !== 'textarea'"
      ref="inputRef"
      v-model="model"
      :class="[
        cn(variants({ variant }), props.class),
        { 'pr-9': clearable && model },
        { 'text-text-muted cursor-not-allowed': disabled },
        { 'text-text-muted': readonly },
      ]"
      :placeholder="placeholder"
      :type="type"
      v-bind="attrs"
      :disabled="disabled || readonly"
    >
    <textarea
      v-else
      v-model="model"
      :class="[
        cn(variants({ variant }), props.class),
        { 'pr-9': clearable && model },
        { 'text-text-muted cursor-not-allowed': disabled },
        { 'text-text-muted': readonly },
      ]"
      :placeholder="placeholder"
      :rows="rows || 3"
      v-bind="attrs"
      :disabled="disabled || readonly"
    />
    <UiButton
      v-if="clearable && model"
      class="absolute top-1/2 right-2 -translate-y-1/2"
      variant="icon"
      size="sm"
      @click="clear"
    >
      <X class="h-3 w-3" />
    </UiButton>
  </div>
</template>
