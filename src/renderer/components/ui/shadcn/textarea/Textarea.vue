<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { TextareaVariants } from '.'
import { cn } from '@/utils'
import { useVModel } from '@vueuse/core'
import { textareaVariants } from '.'

const props = defineProps<{
  class?: HTMLAttributes['class']
  defaultValue?: string | number
  modelValue?: string | number
  variant?: TextareaVariants['variant']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :class="cn(textareaVariants({ variant }), props.class)"
  />
</template>
