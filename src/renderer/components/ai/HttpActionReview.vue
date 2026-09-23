<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiHttpActionView } from '~/shared/aiHttpActions'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'

const props = defineProps<{ message: ChatMessage, action: AiHttpActionView }>()
const { applyHttpAction, cancelHttpAction } = useAi()
const open = ref(false)
const busy = ref(false)
const failed = ref(false)
const previewText = computed(() => formatHttpData(props.action.preview))
const resultText = computed(() => formatHttpData(props.action.result))

function formatHttpData(value: unknown) {
  if (
    value
    && typeof value === 'object'
    && 'content' in value
    && typeof value.content === 'string'
    && 'nextOffset' in value
    && value.nextOffset === null
    && 'totalLength' in value
    && value.totalLength === value.content.length
  ) {
    try {
      return JSON.stringify(JSON.parse(value.content), null, 2)
    }
    catch {
      // Keep the original envelope when the content is not valid JSON.
    }
  }
  return JSON.stringify(value, null, 2)
}

async function apply() {
  busy.value = true
  try {
    failed.value = !(await applyHttpAction(props.message, props.action))
  }
  finally {
    busy.value = false
  }
  if (!failed.value)
    open.value = false
}
</script>

<template>
  <div class="space-y-2">
    <UiText variant="caption">
      {{ i18n.t(`ai.httpActions.states.${action.state}`) }}:
      {{ action.summary }}
    </UiText>
    <Button
      v-if="action.state === 'pending'"
      variant="outline"
      size="sm"
      @click="open = true"
    >
      {{ i18n.t("ai.httpActions.review") }}
    </Button>
    <Button
      v-if="action.state === 'running'"
      variant="outline"
      size="sm"
      @click="cancelHttpAction(action)"
    >
      {{ i18n.t("ai.stop") }}
    </Button>
    <pre
      v-if="action.result"
      class="text-xs break-all whitespace-pre-wrap"
    >{{
      resultText
    }}</pre>
    <Dialog.Dialog v-model:open="open">
      <Dialog.DialogContent
        class="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-3xl"
        @open-auto-focus="(event) => event.preventDefault()"
        @close-auto-focus="(event) => event.preventDefault()"
      >
        <Dialog.DialogHeader>
          <Dialog.DialogTitle>
            {{ i18n.t("ai.httpActions.review") }}
          </Dialog.DialogTitle>
          <Dialog.DialogDescription>
            {{ i18n.t("ai.httpActions.description") }}
          </Dialog.DialogDescription>
        </Dialog.DialogHeader>
        <UiText variant="sm">
          {{ i18n.t(`ai.httpActions.actions.${action.action}`) }} ·
          {{ i18n.t(`ai.httpActions.sources.${action.source}`) }}
        </UiText>
        <pre
          class="scrollbar min-h-0 overflow-auto text-xs break-all whitespace-pre-wrap"
        >{{ previewText }}</pre>
        <UiText
          v-if="failed"
          variant="sm"
          class="text-destructive"
        >
          {{ i18n.t("ai.httpActions.failed") }}
        </UiText>
        <Dialog.DialogFooter>
          <Button
            variant="ghost"
            :disabled="busy"
            @click="
              cancelHttpAction(action);
              open = false;
            "
          >
            {{ i18n.t("ai.edit.reject") }}
          </Button>
          <Button
            :disabled="busy || action.state !== 'pending'"
            @click="apply"
          >
            {{ i18n.t("ai.edit.apply") }}
          </Button>
        </Dialog.DialogFooter>
      </Dialog.DialogContent>
    </Dialog.Dialog>
  </div>
</template>
