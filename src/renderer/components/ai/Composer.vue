<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'
import { ArrowUp, Square } from 'lucide-vue-next'

const props = defineProps<{ ready: boolean }>()
const emit = defineEmits<{ submit: [] }>()
const { conversation, isStreaming, send, cancel } = useAi()
const draft = computed({
  get: () => conversation.value?.draft ?? '',
  set: (value: string | number) => {
    if (conversation.value)
      conversation.value.draft = String(value)
  },
})
const canSend = computed(
  () => props.ready && !isStreaming.value && Boolean(draft.value.trim()),
)
function submit() {
  if (!canSend.value)
    return
  emit('submit')
  void send(draft.value)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="shrink-0 p-2">
    <div
      class="border-input bg-background focus-within:border-ring overflow-hidden rounded-lg border shadow-xs"
    >
      <Textarea
        v-model="draft"
        variant="ghost"
        :rows="1"
        class="scrollbar max-h-48 min-h-10 resize-none rounded-none px-3 py-2 text-sm"
        :placeholder="i18n.t('ai.placeholder')"
        :aria-label="i18n.t('ai.placeholder')"
        @keydown="onKeydown"
      />
      <div class="bg-muted/40 flex items-end gap-2 border-t px-2 py-1.5">
        <AiContextPicker class="min-w-0 flex-1" />
        <Button
          v-if="isStreaming"
          size="icon"
          variant="secondary"
          class="size-7 shrink-0"
          :aria-label="i18n.t('ai.stop')"
          :title="i18n.t('ai.stop')"
          @click="cancel"
        >
          <Square class="size-3 fill-current" />
        </Button>
        <Button
          v-else
          size="icon"
          class="size-7 shrink-0"
          :disabled="!canSend"
          :aria-label="i18n.t('ai.send')"
          :title="i18n.t('ai.send')"
          @click="submit"
        >
          <ArrowUp class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
