<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiResult } from '~/shared/ai'
import type { WorkspaceCreation } from '~/shared/aiWorkspace'
import { Button } from '@/components/ui/shadcn/button'
import { useAi } from '@/composables/ai/useAi'
import { i18n, ipc } from '@/electron'

const props = defineProps<{
  message: ChatMessage
  creation: WorkspaceCreation
}>()
const { markWorkspaceUndone } = useAi()
const busy = ref(false)
const failed = ref<number>()
const rows = computed(() =>
  props.creation.proposal.changes.map((change, index) => {
    const undone = props.creation.undone?.includes(index)
    const applied = props.creation.applied?.includes(index) && !undone
    const op = change.operation
    const createdKey
      = op.kind === 'folder'
        ? op.fields.collection
          ? 'createdCollection'
          : 'createdFolder'
        : { code: 'createdCode', notes: 'createdNotes', http: 'createdHttp' }[
            op.space
          ]
    return {
      index,
      name: change.name,
      applied,
      state: undone
        ? 'cancelled'
        : applied
          ? 'done'
          : props.creation.failedOperationIndex === index
            ? 'failed'
            : 'pending',
      label: i18n.t(
        `ai.workspace.${undone ? 'creationUndone' : applied ? createdKey : props.creation.failedOperationIndex === index ? 'creationFailed' : 'creationNotAttempted'}`,
      ),
      item: undone
        ? undefined
        : props.creation.items?.find(item => item.operationIndex === index),
    }
  }),
)
async function undo(index: number) {
  if (busy.value)
    return
  busy.value = true
  failed.value = undefined
  try {
    const result = (await ipc.invoke('system:ai:workspace-undo', {
      id: props.creation.proposal.id,
      index,
    })) as AiResult<boolean>
    if (result.ok)
      markWorkspaceUndone(props.message, index, props.creation.proposal.id)
    else failed.value = index
  }
  catch {
    failed.value = index
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="row in rows"
      :key="row.index"
      class="space-y-1"
    >
      <UiStatus :state="row.state">
        {{ row.label }}
      </UiStatus>
      <div class="flex flex-wrap items-baseline gap-2">
        <AiVaultLink
          v-if="row.item"
          :item="row.item"
        />
        <UiText
          v-else
          variant="sm"
          muted
        >
          {{ row.name }}
        </UiText>
        <Button
          v-if="row.applied"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="undo(row.index)"
        >
          {{ i18n.t("ai.workspace.undoCreation") }}
        </Button>
      </div>
      <UiText
        v-if="failed === row.index"
        as="p"
        variant="sm"
        class="text-destructive"
        role="alert"
      >
        {{ i18n.t("ai.workspace.undoFailed") }}
      </UiText>
    </div>
  </div>
</template>
