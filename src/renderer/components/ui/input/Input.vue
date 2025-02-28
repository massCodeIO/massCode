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
}

const props = defineProps<Props>()
const model = defineModel<string>()

function clear() {
  model.value = ''
}
</script>

<template>
  <div class="relative flex">
    <input
      v-model="model"
      :class="[
        cn(variants({ variant }), props.class),
        { 'pr-9': clearable && model },
      ]"
      :placeholder="placeholder"
      type="text"
    >
    <UiButton
      v-if="clearable && model"
      class="absolute right-2 top-1/2 -translate-y-1/2"
      variant="icon"
      size="sm"
      @click="clear"
    >
      <X class="w-3 h-3" />
    </UiButton>
  </div>
</template>
