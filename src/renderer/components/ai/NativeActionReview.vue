<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiNativeActionView } from '~/shared/aiNativeActions'
import { Button } from '@/components/ui/shadcn/button'
import { preferenceReview } from '@/composables/ai/preferenceReview'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'
import { isBoundaryNativeAction } from '~/shared/aiNativeActions'
import { nativeActionTitle } from './actionTitle'

const props = defineProps<{
  message: ChatMessage
  action: AiNativeActionView
}>()
const { applyNativeAction, cancelNativeAction, isStreaming } = useAi()
const targetItem = computed(() => {
  const operation = props.action.operation
  if (!operation || !('target' in operation))
    return undefined
  const target = operation.target
  const type
    = target.space === 'code'
      ? 'snippet'
      : target.space === 'notes'
        ? 'note'
        : 'http_request'
  const items = [
    ...(props.message.attachments ?? []),
    ...(props.message.searchResults ?? []).flatMap(result => result.items),
    ...(props.message.workspaceItems ?? []),
    ...(props.message.workspaceCreations ?? []).flatMap(creation =>
      creation.items.filter(
        item => !creation.undone.includes(item.operationIndex),
      ),
    ),
  ]
  return items.find(item => item.type === type && item.id === target.id)
})
const preference = computed(() =>
  props.action.operation?.action === 'setPreferences'
    ? preferenceReview(props.action.operation.change)
    : undefined,
)
const busy = ref(false)
const failed = ref(false)
async function perform(accept: boolean) {
  if (busy.value)
    return
  busy.value = true
  failed.value = false
  try {
    if (accept)
      await applyNativeAction(props.message, props.action)
    else await cancelNativeAction(props.message, props.action)
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
  <div
    v-if="action.operation"
    class="space-y-2 rounded-md border p-3"
  >
    <UiText
      as="p"
      variant="sm"
    >
      {{ nativeActionTitle(action.operation, action.status) }}
    </UiText>
    <AiVaultLink
      v-if="targetItem"
      :item="targetItem"
    />
    <UiText
      v-else-if="'target' in action.operation"
      as="p"
      variant="caption"
      muted
    >
      {{ action.operation.target.space }} · {{ action.operation.target.id }}
    </UiText>
    <UiText
      v-if="
        action.operation.action === 'codePreview'
          || (action.operation.action === 'setView'
            && action.operation.view === 'codePreview')
      "
      as="p"
      variant="sm"
    >
      {{ i18n.t("ai.native.previewExecution") }}
    </UiText>
    <template v-if="preference">
      <UiText
        as="p"
        variant="caption"
        muted
      >
        {{ preference.label }}
      </UiText>
      <UiText
        v-for="row in preference.rows"
        :key="row.label"
        as="p"
        variant="caption"
        class="break-all"
      >
        {{ row.label }}: {{ row.value }}
      </UiText>
      <UiText
        v-if="preference.sensitive"
        as="p"
        variant="caption"
      >
        {{ i18n.t("ai.native.sensitiveSettings") }}
      </UiText>
    </template>
    <UiText
      v-if="isBoundaryNativeAction(action.operation)"
      as="p"
      variant="caption"
    >
      {{ i18n.t("ai.native.boundaryWarning") }}
    </UiText>
    <UiText
      v-if="action.operation.action === 'storage'"
      as="p"
      variant="caption"
    >
      {{ i18n.t(`ai.native.storageCommands.${action.operation.command}`) }}
    </UiText>
    <AiNativeOutcome
      v-if="action.result?.storage || action.result?.profile"
      :result="action.result!"
    />
    <UiText
      v-if="action.result?.reloadRequired"
      as="p"
      variant="caption"
    >
      {{ i18n.t("ai.native.reloadRequired") }}
    </UiText>
    <UiStatus :state="action.status">
      {{ i18n.t(`ai.native.${action.status}`) }}
    </UiStatus>
    <UiText
      v-if="action.result?.filePath"
      as="p"
      variant="caption"
      class="break-all select-text"
    >
      {{ action.result.filePath }}
    </UiText>
    <div
      v-if="
        action.status === 'pending'
          && isStreaming
          && message.status === 'streaming'
      "
      class="flex gap-2"
    >
      <Button
        size="sm"
        :disabled="busy"
        @click="perform(true)"
      >
        {{
          i18n.t(
            action.operation.action === "setView"
              && action.operation.view === "codePreview"
              ? "ai.native.openPreview"
              : `ai.native.actions.${action.operation.action}`,
          )
        }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        :disabled="busy"
        @click="perform(false)"
      >
        {{ i18n.t("ai.edit.cancel") }}
      </Button>
    </div>
    <UiText
      v-if="failed"
      as="p"
      variant="caption"
      class="text-destructive"
      role="alert"
    >
      {{ i18n.t("ai.native.failed") }}
    </UiText>
  </div>
</template>
