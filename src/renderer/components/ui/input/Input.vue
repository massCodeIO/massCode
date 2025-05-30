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
  error?: string
  description?: string
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
  <div>
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
          { 'border-red-500': error },
        ]"
        :placeholder="placeholder"
        :type="type"
        v-bind="attrs"
        :disabled="disabled || readonly"
      >
      <textarea
        v-else
        v-model="model"
        class="scrollbar"
        :class="[
          cn(variants({ variant }), props.class),
          { 'pr-9': clearable && model },
          { 'text-text-muted cursor-not-allowed': disabled },
          { 'text-text-muted': readonly },
          { 'border-red-500': error },
        ]"
        :placeholder="placeholder"
        :rows="rows || 3"
        v-bind="attrs"
        :disabled="disabled || readonly"
      />

      <div
        v-if="clearable && model"
        class="border-border absolute top-1/2 right-3 -translate-y-1/2 rounded-full border p-0.5"
        @click="clear"
      >
        <X class="text-text-muted h-3 w-3" />
      </div>
    </div>
    <div
      v-if="description"
      class="text-text-muted mt-1 text-xs"
    >
      {{ description }}
    </div>
    <div
      v-if="error"
      class="text-sm text-red-500"
    >
      {{ error }}
    </div>
  </div>
</template>
