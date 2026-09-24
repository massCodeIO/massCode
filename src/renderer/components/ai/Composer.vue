<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'
import { ArrowUp, Square } from 'lucide-vue-next'

const props = defineProps<{ ready: boolean }>()
const emit = defineEmits<{ submit: [] }>()
const {
  conversation,
  isStreaming,
  send,
  cancel,
  steer,
  enqueue,
  runQueued,
  removeQueued,
} = useAi()
const draft = computed({
  get: () => conversation.value?.draft ?? '',
  set: (value: string | number) => {
    if (conversation.value)
      conversation.value.draft = String(value)
  },
})
const busy = ref(false)
const failed = ref(false)
const canSend = computed(
  () => props.ready && !busy.value && Boolean(draft.value.trim()),
)
async function submit() {
  if (!canSend.value)
    return
  emit('submit')
  busy.value = true
  failed.value = false
  try {
    failed.value = !(isStreaming.value
      ? await steer(draft.value)
      : await send(draft.value))
  }
  catch {
    failed.value = true
  }
  finally {
    busy.value = false
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="shrink-0 space-y-2 p-2">
    <div
      v-for="task in conversation?.queue"
      :key="task.id"
      class="flex items-center gap-2 rounded-md border p-2"
    >
      <UiText
        variant="caption"
        class="min-w-0 flex-1 truncate"
      >
        {{ i18n.t("ai.task.queued") }}: {{ task.prompt }}
      </UiText>
      <Button
        v-if="!isStreaming"
        variant="outline"
        size="sm"
        @click="runQueued"
      >
        {{ i18n.t("ai.task.startQueue") }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        @click="removeQueued(task.id)"
      >
        {{ i18n.t("ai.task.removeQueue") }}
      </Button>
    </div>
    <UiText
      v-if="failed"
      as="p"
      variant="caption"
      class="text-destructive"
      role="alert"
    >
      {{ i18n.t("ai.task.messageFailed") }}
    </UiText>
    <div
      class="border-input bg-background focus-within:border-ring overflow-hidden rounded-lg border shadow-xs"
    >
      <Textarea
        v-model="draft"
        data-ai-prompt
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
          v-if="isStreaming && draft.trim()"
          variant="outline"
          size="sm"
          :disabled="busy || (conversation?.queue?.length ?? 0) >= 8"
          @click="enqueue(draft)"
        >
          {{ i18n.t("ai.task.queue") }}
        </Button>
        <Button
          size="icon"
          class="size-7 shrink-0"
          :disabled="!canSend"
          :aria-label="i18n.t(isStreaming ? 'ai.task.steer' : 'ai.send')"
          :title="i18n.t(isStreaming ? 'ai.task.steer' : 'ai.send')"
          @click="submit"
        >
          <ArrowUp class="size-4" />
        </Button>
      </div>
    </div>
    <UiText
      v-if="isStreaming"
      as="p"
      variant="caption"
      muted
    >
      {{ i18n.t("ai.task.controlHint") }}
    </UiText>
  </div>
</template>
