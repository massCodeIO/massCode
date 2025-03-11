<script setup lang="ts">
import type { Variants } from './variants'
import { cn } from '@/utils'
import { X } from 'lucide-vue-next'
import { variants } from './variants'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
})

const attrs = useAttrs()

interface Props {
  variant?: Variants['variant']
  class?: string
  placeholder?: string
  clearable?: boolean
  type?: 'text' | 'number' | 'textarea'
  focus?: boolean
  select?: boolean
}

const model = defineModel<string>()

function clear() {
  model.value = ''
}

const inputRef = ref<HTMLInputElement>()

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
  <div :class="{ 'relative flex': clearable && model }">
    <input
      v-if="type !== 'textarea'"
      ref="inputRef"
      v-model="model"
      :class="[
        cn(variants({ variant }), props.class),
        { 'pr-9': clearable && model },
      ]"
      :placeholder="placeholder"
      :type="type"
      v-bind="attrs"
    >
    <textarea
      v-else
      ref="inputRef"
      v-model="model"
      v-bind="$attrs"
      :class="[
        cn(variants({ variant }), props.class),
        { 'pr-9': clearable && model },
      ]"
    />
    <UiButton
      v-if="clearable && model && type !== 'textarea'"
      class="absolute top-1/2 right-2 -translate-y-1/2"
      variant="icon"
      size="sm"
      @click="clear"
    >
      <X class="h-3 w-3" />
    </UiButton>
  </div>
</template>
