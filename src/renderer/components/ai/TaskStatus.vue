<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import { Button } from '@/components/ui/shadcn/button'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'

const props = defineProps<{ message: ChatMessage }>()
const { answerQuestion, isStreaming } = useAi()
const answer = ref('')
const busy = ref(false)
const failed = ref(false)
const question = computed(() => props.message.clarification)
const pending = computed(
  () =>
    isStreaming.value
    && props.message.status === 'streaming'
    && question.value
    && !question.value.answer
    && !question.value.cancelled,
)
async function submit(value: string) {
  if (!pending.value || busy.value || !value.trim())
    return
  busy.value = true
  try {
    failed.value = !(await answerQuestion(props.message, value))
  }
  catch {
    failed.value = true
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <UiText
      v-if="message.status === 'streaming'"
      variant="caption"
      muted
      role="status"
    >
      {{ i18n.t(`ai.task.${message.taskState ?? "working"}`) }}
    </UiText>
    <UiText
      v-if="message.status === 'cancelled'"
      variant="caption"
      muted
    >
      {{ i18n.t("ai.task.stopped") }}
    </UiText>
    <details
      v-if="
        message.editorSnapshot
          || message.workspaceContext
          || message.attachments?.length
      "
      class="rounded-md border px-3 py-2"
    >
      <summary>
        <UiText variant="caption">
          {{ i18n.t("ai.task.context") }}
        </UiText>
      </summary>
      <UiText
        v-if="message.editorSnapshot"
        as="p"
        variant="caption"
        class="mt-2"
      >
        {{ message.editorSnapshot.name }} · {{ message.editorSnapshot.space }} ·
        {{
          message.editorSnapshot.space === "code"
            ? `${message.editorSnapshot.snippetId}/${message.editorSnapshot.contentId}`
            : message.editorSnapshot.noteId
        }}
      </UiText>
      <UiText
        v-if="message.workspaceContext"
        as="p"
        variant="caption"
      >
        {{ message.workspaceContext.space }} ·
        {{
          i18n.t("ai.task.selection", {
            ids: message.workspaceContext.selectedIds.join(", ") || "—",
          })
        }}
      </UiText>
      <UiText
        v-for="item in message.attachments"
        :key="`${item.type}:${item.id}`"
        as="p"
        variant="caption"
      >
        {{ item.name }}
      </UiText>
      <UiText
        as="p"
        variant="caption"
        muted
      >
        {{ i18n.t("ai.task.capturedHint") }}
      </UiText>
    </details>
    <div
      v-for="(text, index) in message.steering"
      :key="index"
      class="bg-muted rounded-md px-3 py-2"
    >
      <UiText
        variant="caption"
        muted
      >
        {{ i18n.t("ai.task.steering") }}
      </UiText>
      <UiText
        as="p"
        variant="sm"
        class="whitespace-pre-wrap"
      >
        {{ text }}
      </UiText>
    </div>
    <div
      v-if="question"
      class="space-y-2 rounded-md border p-3"
    >
      <UiText
        as="p"
        variant="sm"
      >
        {{ question.question }}
      </UiText>
      <template v-if="pending">
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="option in question.options"
            :key="option"
            variant="outline"
            size="sm"
            :disabled="busy"
            @click="submit(option)"
          >
            {{ option }}
          </Button>
        </div>
        <Textarea
          v-model="answer"
          :aria-label="i18n.t('ai.task.answer')"
          :placeholder="i18n.t('ai.task.answer')"
          :disabled="busy"
          :rows="2"
        />
        <Button
          size="sm"
          :disabled="busy || !answer.trim()"
          @click="submit(answer)"
        >
          {{ i18n.t("ai.task.reply") }}
        </Button>
        <UiText
          v-if="failed"
          as="p"
          variant="caption"
          class="text-destructive"
          role="alert"
        >
          {{ i18n.t("ai.task.replyFailed") }}
        </UiText>
      </template>
      <UiText
        v-else
        as="p"
        variant="sm"
      >
        {{ question.answer ?? i18n.t("ai.task.questionClosed") }}
      </UiText>
    </div>
  </div>
</template>
