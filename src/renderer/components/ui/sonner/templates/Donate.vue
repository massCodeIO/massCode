<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { i18n, ipc } from '@/electron'
import { X } from 'lucide-vue-next'

interface Props {
  title: string
  variant: 'full' | 'short'
}

interface Emits {
  (e: 'closeToast'): void
}

defineProps<Props>()

const emit = defineEmits<Emits>()

function onSupport() {
  ipc.invoke('system:open-external', 'https://masscode.io/donate')
  emit('closeToast')
}

function onDismiss() {
  emit('closeToast')
}
</script>

<template>
  <div
    class="bg-background border-border relative w-[var(--width)] rounded-md border p-3 shadow-lg"
  >
    <button
      class="border-border bg-background hover:bg-muted absolute -top-2.5 -left-2.5 cursor-default rounded-full border p-0.5"
      @click="emit('closeToast')"
    >
      <X class="text-text h-4 w-4" />
    </button>
    <div class="space-y-2">
      <div class="text-sm font-medium">
        {{ title }}
      </div>
      <div class="text-muted-foreground text-sm whitespace-pre-line">
        <template v-if="variant === 'full'">
          {{ i18n.t("messages:donations.body.full") }}
        </template>
        <template v-else>
          {{ i18n.t("messages:donations.body.short") }}
        </template>
      </div>
      <div class="flex gap-2 pt-1">
        <Button
          size="sm"
          @click="onSupport"
        >
          {{ i18n.t("messages:donations.actions.support") }}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          @click="onDismiss"
        >
          {{ i18n.t("messages:donations.actions.dismiss") }}
        </Button>
      </div>
    </div>
  </div>
</template>
