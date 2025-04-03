<script setup lang="ts">
import type { Props } from './types'
import { CheckCircle2, Info, XCircle } from 'lucide-vue-next'

interface Emits {
  (e: 'closeToast'): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

function onActionClick() {
  props.action?.onClick()
  emit('closeToast')
}

const icon = computed(() => {
  if (props.type === 'success') {
    return CheckCircle2
  }
  if (props.type === 'error') {
    return XCircle
  }

  return Info
})
</script>

<template>
  <div
    class="bg-bg border-border relative w-[356px] rounded-md border p-3 shadow-lg"
    :class="{ 'border-red-700': type === 'error' }"
  >
    <div class="grid grid-cols-[20px_1fr_auto] items-center gap-2">
      <div class="flex- shrink-0">
        <component
          :is="icon"
          class="h-4 w-4"
          :class="{
            'text-red-700': type === 'error',
            'text-green-500': type === 'success',
          }"
        />
      </div>
      <div class="pr-6">
        {{ message }}
      </div>
      <UiButton
        v-if="action"
        class="shrink-0"
        size="md"
        @click="onActionClick"
      >
        {{ action.label }}
      </UiButton>
    </div>
    <!-- <UiButton
      variant="icon"
      size="icon"
      class="absolute -top-3 -left-4"
      @click="$emit('closeToast')"
    >
      <X class="w-4 h-4" />
    </UiButton> -->
  </div>
</template>
