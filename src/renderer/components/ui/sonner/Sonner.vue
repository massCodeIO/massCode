<script setup lang="ts">
import type { Props } from './types'
import { Button } from '@/components/ui/shadcn/button'
import { i18n } from '@/electron'
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
    class="bg-background text-foreground border-border relative w-[var(--width)] rounded-md border p-3 shadow-lg"
    :class="{
      'border-destructive/25': type === 'error',
      'border-warning/25': type === 'warning',
      'border-success/25': type === 'success',
    }"
  >
    <div class="flex items-start gap-2">
      <component
        :is="icon"
        aria-hidden="true"
        class="mt-0.5 size-4 shrink-0"
        :class="{
          'text-destructive': type === 'error',
          'text-success': type === 'success',
          'text-warning': type === 'warning',
          'text-muted-foreground': !type || type === 'default',
        }"
      />
      <div class="min-w-0 flex-1 space-y-2">
        <UiText
          v-if="message"
          as="div"
          variant="sm"
          class="break-words"
        >
          {{ message }}
        </UiText>
        <component
          :is="component"
          v-if="component"
          @close-toast="emit('closeToast')"
        />
        <Button
          v-if="action"
          size="sm"
          variant="outline"
          @click="onActionClick"
        >
          {{ action.label }}
        </Button>
      </div>
      <Button
        v-if="closeButton"
        size="icon"
        variant="ghost"
        class="size-6 shrink-0"
        :aria-label="i18n.t('action.close')"
        @click="emit('closeToast')"
      >
        <X class="size-4" />
      </Button>
    </div>
  </div>
</template>
