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
function apply() {
  failed.value = !applyHttp(props.message)
  if (!failed.value)
    open.value = false
}
function reject() {
  rejectEdit(props.message)
  open.value = false
}
</script>

<template>
  <UiText
    v-if="message.applied"
    variant="caption"
    muted
  >
    {{ i18n.t("ai.http.applied") }}
  </UiText>
  <UiText
    v-else-if="message.rejected"
    variant="caption"
    muted
  >
    {{ i18n.t("ai.edit.rejected") }}
  </UiText>
  <template v-else-if="message.status === 'done'">
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
      class="max-w-2xl"
      @open-auto-focus="(event) => event.preventDefault()"
      @close-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>{{ i18n.t("ai.http.review") }}</Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("ai.http.description") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <UiText
        as="p"
        variant="sm"
      >
        {{ message.httpSnapshot?.context.name }}
      </UiText>
      <UiText
        as="p"
        variant="sm"
      >
        {{ message.httpProposal?.summary }}
      </UiText>
      <div class="scrollbar max-h-[50vh] space-y-3 overflow-auto">
        <div
          v-for="(rule, index) in message.httpProposal?.assertions"
          :key="index"
          class="space-y-1 rounded-md border p-3"
        >
          <UiText
            as="p"
            variant="sm"
            weight="medium"
          >
            {{ rule.name }}
          </UiText>
          <UiText
            as="p"
            variant="sm"
            muted
          >
            {{ i18n.t(`spaces.http.runtime.sources.${rule.source}`) }}
            <span
              v-if="rule.path"
              class="font-mono"
            > · {{ rule.path }}</span>
          </UiText>
          <UiText
            as="p"
            variant="sm"
          >
            {{ i18n.t(`spaces.http.runtime.operators.${rule.operator}`) }}
            <span
              v-if="rule.expected !== undefined"
              class="font-mono"
            >
              {{ JSON.stringify(rule.expected) }}</span>
          </UiText>
        </div>
      </div>
      <UiText
        v-if="!available || failed"
        variant="sm"
        class="text-destructive"
        role="alert"
      >
        {{ i18n.t("ai.http.stale") }}
      </UiText>
      <Dialog.DialogFooter>
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
