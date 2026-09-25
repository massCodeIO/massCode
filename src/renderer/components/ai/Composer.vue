<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { useAi } from '@/composables/ai/useAi'
import { usePromptHistory } from '@/composables/ai/usePromptHistory'
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
const history = usePromptHistory(draft)
watch(conversation, () => history.reset())
function queueDraft() {
  const prompt = draft.value
  if (enqueue(prompt))
    history.remember(prompt)
}
const steering = computed(() =>
  isStreaming.value
    ? (conversation.value?.messages.at(-1)?.steering ?? [])
    : [],
)
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
  const prompt = draft.value
  try {
    failed.value = !(isStreaming.value
      ? await steer(prompt)
      : await send(prompt))
    if (!failed.value)
      history.remember(prompt)
  }
  catch {
    failed.value = true
  }
  finally {
    busy.value = false
  }
}
function onKeydown(event: KeyboardEvent) {
  history.onKeydown(event)
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
    <div>
      <div
        v-if="steering.length"
        class="border-input bg-muted/40 scrollbar mx-2 max-h-32 overflow-y-auto rounded-t-lg border border-b-0"
        role="status"
        :aria-label="i18n.t('ai.task.steering')"
      >
        <div
          v-for="(text, index) in steering"
          :key="index"
          class="border-input border-b px-3 py-2 last:border-b-0"
        >
          <UiText
            as="p"
            variant="caption"
            muted
          >
            {{ i18n.t("ai.task.steering") }}
          </UiText>
          <UiText
            as="p"
            variant="sm"
            class="break-words whitespace-pre-wrap"
          >
            {{ text }}
          </UiText>
        </div>
      </div>
      <div
        v-if="failed"
        class="border-input bg-muted/40 mx-2 rounded-t-lg border border-b-0 px-3 py-1.5"
        role="alert"
      >
        <UiText
          as="p"
          variant="caption"
          class="text-destructive"
        >
          {{ i18n.t("ai.task.messageFailed") }}
        </UiText>
      </div>
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
          @input="history.onInput()"
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
            @click="queueDraft"
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
    </div>
  </div>
</template>
