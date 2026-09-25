<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'

const props = defineProps<{ message: ChatMessage }>()
const { canApplyHttp, applyHttp, rejectEdit } = useAi()
const open = ref(false)
const failed = ref(false)
const available = computed(() => canApplyHttp(props.message))
async function apply() {
  failed.value = !(await applyHttp(props.message))
  if (!failed.value)
    open.value = false
}
function reject() {
  rejectEdit(props.message)
  open.value = false
}
</script>

<template>
  <UiStatus
    v-if="message.applied"
    state="applied"
  >
    {{ i18n.t("ai.http.applied") }}
  </UiStatus>
  <UiStatus
    v-else-if="message.rejected"
    state="rejected"
  >
    {{ i18n.t("ai.edit.rejected") }}
  </UiStatus>
  <template v-else-if="message.mutationId || message.status === 'done'">
    <Button
      variant="outline"
      size="sm"
      @click="
        open = true;
        failed = false;
      "
    >
      {{ i18n.t("ai.http.review") }}
    </Button>
    <UiText
      variant="caption"
      muted
      role="status"
    >
      {{ i18n.t("ai.edit.pending") }}
    </UiText>
  </template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-5xl"
      @open-auto-focus="(event) => event.preventDefault()"
      @close-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader class="shrink-0">
        <Dialog.DialogTitle>{{ i18n.t("ai.http.review") }}</Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("ai.http.description") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div class="scrollbar min-h-0 space-y-4 overflow-auto">
        <UiText
          as="p"
          variant="sm"
          class="break-words"
        >
          {{ message.httpSnapshot?.context.name }}
        </UiText>
        <AiHttpChecks
          v-if="message.httpProposal"
          :proposal="message.httpProposal"
          show-evidence
        />
      </div>
      <UiText
        v-if="!available || failed"
        variant="sm"
        class="text-destructive"
        role="alert"
      >
        {{ i18n.t("ai.http.stale") }}
      </UiText>
      <Dialog.DialogFooter class="shrink-0">
        <Button
          variant="ghost"
          @click="reject"
        >
          {{ i18n.t("ai.edit.reject") }}
        </Button>
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ i18n.t("ai.edit.cancel") }}
        </Button>
        <Button
          :disabled="!available"
          @click="apply"
        >
          {{ i18n.t("ai.http.apply") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
