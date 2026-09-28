<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import { Button } from '@/components/ui/shadcn/button'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'

const props = defineProps<{ message: ChatMessage }>()
const { undoTask, isStreaming } = useAi()
const available = computed(() =>
  props.message.taskMutations?.some(receipt => !receipt.undone),
)
</script>

<template>
  <Button
    v-if="available"
    variant="outline"
    size="sm"
    :disabled="isStreaming || message.undoBusy"
    @click="undoTask(message)"
  >
    {{ i18n.t("ai.task.undo") }}
  </Button>
  <UiText
    v-if="message.undoConflicts?.length"
    variant="caption"
    class="text-destructive"
  >
    {{ i18n.t("ai.task.undoConflicts") }}:
    {{ message.undoConflicts.join(", ") }}
  </UiText>
  <UiText
    v-if="message.taskIrreversible"
    variant="caption"
  >
    {{ i18n.t("ai.task.irreversible") }}
  </UiText>
</template>
