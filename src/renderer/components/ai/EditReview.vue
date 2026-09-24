<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import { Button } from '@/components/ui/shadcn/button'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'

const props = defineProps<{ message: ChatMessage }>()
const { context, canApply, applyEdit, rejectEdit } = useAi()
const open = ref(false)
const failed = ref(false)
const original = computed(
  () =>
    props.message.edit?.text.slice(
      props.message.edit.from,
      props.message.edit.to,
    ) ?? '',
)
const replacement = computed(() => props.message.replacement)
const available = computed(() => {
  // Subscribe to editor changes while the review dialog is open.
  void context.value
  return !props.message.mutationBusy && canApply(props.message)
})
function reject() {
  rejectEdit(props.message)
  open.value = false
}
async function apply() {
  failed.value = !(await applyEdit(props.message))
  if (!failed.value)
    open.value = false
}
</script>

<template>
  <UiText
    v-if="message.applied"
    variant="caption"
    muted
  >
    {{ i18n.t("ai.edit.applied") }}
  </UiText>
  <UiText
    v-else-if="message.rejected"
    variant="caption"
    muted
  >
    {{ i18n.t("ai.edit.rejected") }}
  </UiText>
  <template v-else-if="message.mutationId || message.status !== 'streaming'">
    <div
      v-if="replacement !== undefined"
      class="flex flex-wrap items-center gap-2"
    >
      <Button
        variant="outline"
        size="sm"
        @click="
          open = true;
          failed = false;
        "
      >
        {{ i18n.t("ai.edit.review") }}
      </Button>
      <UiText
        variant="caption"
        muted
        role="status"
      >
        {{ i18n.t("ai.edit.pending") }}
      </UiText>
    </div>
    <UiText
      v-else-if="message.editRequested || message.calls?.length"
      variant="caption"
      muted
    >
      {{ i18n.t("ai.edit.invalid") }}
    </UiText>
  </template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      :zoom="false"
      class="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-5xl"
      @open-auto-focus="(event) => event.preventDefault()"
      @close-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader class="shrink-0">
        <Dialog.DialogTitle>{{ i18n.t("ai.edit.review") }}</Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("ai.edit.description") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div class="scrollbar min-h-0 space-y-3 overflow-auto">
        <UiText
          v-if="message.proposalSummary"
          as="p"
          variant="sm"
        >
          {{ message.proposalSummary }}
        </UiText>
        <AiDiffViewer
          v-if="open"
          :before="original"
          :after="replacement ?? ''"
        />
      </div>
      <UiText
        v-if="(!available && !message.applied) || failed"
        variant="sm"
        class="text-destructive"
        role="alert"
      >
        {{ i18n.t("ai.edit.stale") }}
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
          :disabled="!available || replacement === original"
          @click="apply"
        >
          {{ i18n.t("ai.edit.apply") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
