<script setup lang="ts">
import type { Props } from './types'
import { CheckCircle2, Info, X, XCircle } from 'lucide-vue-next'

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
    class="bg-bg border-border relative w-[var(--width)] rounded-md border p-3 shadow-lg"
    :class="{
      'border-red-700': type === 'error',
    }"
  >
    <div
      v-if="closeButton"
      class="border-border bg-bg hover:bg-button-hover absolute -top-2.5 -left-2.5 rounded-full border p-0.5"
    >
      <X
        class="text-text h-4 w-4"
        @click="emit('closeToast')"
      />
    </div>
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
        <template v-if="message">
          {{ message }}
        </template>
        <component
          :is="component"
          v-if="component"
          @close-toast="emit('closeToast')"
        />
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
  </div>
</template>
