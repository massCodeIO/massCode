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
      v-if="message.status === 'cancelled'"
      as="p"
      variant="caption"
      muted
    >
      {{ i18n.t("ai.task.stopped") }}
    </UiText>
    <div
      v-for="(text, index) in message.status === 'streaming'
        ? []
        : message.steering"
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
