<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { X } from 'lucide-vue-next'

interface Emits {
  (e: 'closeToast'): void
}

const emit = defineEmits<Emits>()

function onOpenPreferences() {
  router.push({ name: RouterName.preferencesSupporter })
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
        {{ i18n.t("messages:update.whatsNewTitle") }}
      </div>
      <div class="text-muted-foreground text-sm whitespace-pre-line">
        {{ i18n.t("messages:update.whatsNewBody") }}
      </div>
      <div class="flex gap-2 pt-1">
        <Button
          size="sm"
          @click="onOpenPreferences"
        >
          {{ i18n.t("messages:update.whatsNewAction") }}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          @click="onDismiss"
        >
          {{ i18n.t("messages:update.whatsNewDismiss") }}
        </Button>
      </div>
    </div>
  </div>
</template>
