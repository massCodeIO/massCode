<script setup lang="ts">
import type { Props } from './types'
import { Button } from '@/components/ui/shadcn/button'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-vue-next'

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
  if (props.type === 'warning') {
    return AlertTriangle
  }

  return Info
})
</script>

<template>
  <div
    class="bg-background border-border relative w-[var(--width)] rounded-md border p-3 shadow-lg"
    :class="{
      'border-red-700': type === 'error',
      'border-yellow-600': type === 'warning',
    }"
  >
    <div
      v-if="closeButton"
      class="border-border bg-background hover:bg-muted absolute -top-2.5 -left-2.5 rounded-full border p-0.5"
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
            'text-yellow-600': type === 'warning',
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
      <Button
        v-if="action"
        class="shrink-0"
        variant="outline"
        @click="onActionClick"
      >
        {{ action.label }}
      </Button>
    </div>
  </div>
</template>
