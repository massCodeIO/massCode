<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiResult } from '~/shared/ai'
import type {
  WorkspaceApplyResult,
  WorkspaceChange,
} from '~/shared/aiWorkspace'
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useAi } from '@/composables/ai/useAi'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n, ipc } from '@/electron'

const props = defineProps<{ message: ChatMessage }>()
const { requestDirty } = useHttpRuntime()
const {
  setWorkspaceItems,
  setWorkspaceApplied,
  markWorkspaceUndone,
  rejectEdit,
} = useAi()
const open = ref(false)
const busy = ref(false)
const failed = ref(false)
const applied = computed(() => props.message.workspaceApplied ?? [])
const undone = computed(() => props.message.workspaceUndone ?? [])
const proposal = computed(() => props.message.workspaceProposal!)
const pending = computed(
  () =>
    !props.message.rejected
    && proposal.value.changes.some(
      (_, i) => !applied.value.includes(i) && !undone.value.includes(i),
    ),
)
const selected = ref<number[]>([])
const blocked = computed(
  () =>
    requestDirty.value
    && selected.value.some(
      index => proposal.value.changes[index]?.operation.space === 'http',
    ),
)
const missingDependency = computed(() =>
  selected.value.some((index) => {
    const parent
      = proposal.value.changes[index]?.operation.fields.folderOperation
    return (
      parent !== undefined
      && !selected.value.includes(parent)
      && !applied.value.includes(parent)
    )
  }),
)
function details(change: WorkspaceChange) {
  const before = JSON.parse(change.before) as Record<string, unknown>
  const after = JSON.parse(change.after) as Record<string, unknown>
  const format = (value: unknown) =>
    value === undefined || value === null
      ? '—'
      : typeof value === 'string'
        ? value
        : Array.isArray(value)
          && value.every(item => typeof item === 'string')
          ? value.join(', ')
          : JSON.stringify(value, null, 2)
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      key =>
        key !== 'contentId'
        && !(key === 'folderId' && before[key] == null && after[key] == null)
        && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .map(key => ({
      key,
      before:
        key === 'folderId' && before[key] == null
          ? i18n.t('ai.workspace.root')
          : format(before[key]),
      after:
        key === 'folderId' && after[key] == null
          ? i18n.t('ai.workspace.root')
          : format(after[key]),
    }))
}
function review() {
  selected.value = props.message.rejected
    ? []
    : proposal.value.changes
        .map((_, i) => i)
        .filter(i => !applied.value.includes(i) && !undone.value.includes(i))
  failed.value = false
  open.value = true
}
function toggle(index: number, checked: unknown) {
  selected.value
    = checked === true
      ? [...selected.value, index]
      : selected.value.filter(i => i !== index)
}
async function apply() {
  if (
    busy.value
    || props.message.rejected
    || blocked.value
    || missingDependency.value
    || !selected.value.length
  ) {
    return
  }
  busy.value = true
  failed.value = false
  try {
    const result = (await ipc.invoke('system:ai:workspace-apply', {
      id: proposal.value.id,
      indexes: [...selected.value],
    })) as AiResult<WorkspaceApplyResult>
    if (!result.ok) {
      failed.value = true
      return
    }
    setWorkspaceItems(props.message, [
      ...(props.message.workspaceItems ?? []),
      ...result.data.items,
    ])
    setWorkspaceApplied(props.message, [
      ...applied.value,
      ...result.data.applied,
    ])
    selected.value = selected.value.filter(
      i => !applied.value.includes(i) && !undone.value.includes(i),
    )
    failed.value = result.data.failed !== undefined
    if (!failed.value)
      open.value = false
  }
  catch {
    failed.value = true
  }
  finally {
    busy.value = false
  }
}
async function undo(index: number) {
  if (busy.value || requestDirty.value)
    return
  busy.value = true
  try {
    const result = (await ipc.invoke('system:ai:workspace-undo', {
      id: proposal.value.id,
      index,
    })) as AiResult<boolean>
    failed.value = !result.ok
    if (result.ok) {
      markWorkspaceUndone(props.message, index)
    }
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
    v-if="message.workspaceItems?.length"
    class="flex flex-wrap items-center gap-2"
  >
    <AiVaultLink
      v-for="item in message.workspaceItems"
      :key="`${item.type}:${item.id}`"
      :item="item"
    />
  </div>
  <Button
    v-if="
      applied.length || (!message.rejected && message.status !== 'streaming')
    "
    variant="outline"
    size="sm"
    @click="review"
  >
    {{ i18n.t("ai.workspace.review") }}
  </Button>
  <UiText
    v-if="message.applied"
    variant="caption"
    muted
  >
    {{ i18n.t("ai.workspace.applied") }}
  </UiText>
  <UiText
    v-else-if="message.rejected"
    variant="caption"
    muted
  >
    {{
      i18n.t(
        applied.length ? "ai.workspace.remainingRejected" : "ai.edit.rejected",
      )
    }}
  </UiText>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="max-w-3xl"
      @open-auto-focus="(event) => event.preventDefault()"
      @close-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("ai.workspace.review") }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("ai.workspace.description") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <UiText
        as="p"
        variant="sm"
      >
        {{ proposal.summary }}
      </UiText>
      <div class="scrollbar max-h-[55vh] space-y-3 overflow-auto">
        <div
          v-for="(change, index) in proposal.changes"
          :key="index"
          class="space-y-2 rounded-md border p-3"
        >
          <label class="flex items-center gap-2">
            <Checkbox
              :model-value="selected.includes(index) || applied.includes(index)"
              :disabled="
                busy
                  || message.rejected
                  || applied.includes(index)
                  || undone.includes(index)
              "
              @update:model-value="(value) => toggle(index, value)"
            />
            <UiText variant="sm">{{ i18n.t(`ai.workspace.${change.operation.action}`) }} ·
              {{ change.name }}</UiText>
            <UiText
              variant="caption"
              muted
            >{{
              i18n.t(`ai.workspace.${change.operation.space}`)
            }}</UiText>
          </label>
          <UiText
            v-if="applied.includes(index)"
            variant="caption"
            muted
          >
            {{ i18n.t("ai.workspace.applied") }}
          </UiText>
          <UiText
            v-if="undone.includes(index)"
            variant="caption"
            muted
          >
            {{ i18n.t("ai.workspace.undone") }}
          </UiText>
          <Button
            v-if="applied.includes(index)"
            variant="outline"
            size="sm"
            :disabled="busy || requestDirty"
            @click="undo(index)"
          >
            {{ i18n.t("ai.workspace.undo") }}
          </Button>
          <div
            v-for="field in details(change)"
            :key="field.key"
            class="space-y-1"
          >
            <UiText
              variant="caption"
              muted
            >
              {{ i18n.t(`ai.workspace.fields.${field.key}`) }}
            </UiText>
            <div class="grid gap-2 sm:grid-cols-2">
              <UiText
                as="div"
                variant="sm"
                class="bg-muted min-w-0 rounded-md p-2 break-words whitespace-pre-wrap"
              >
                {{ field.before }}
              </UiText>
              <UiText
                as="div"
                variant="sm"
                class="border-primary/20 min-w-0 rounded-md border p-2 break-words whitespace-pre-wrap"
              >
                {{ field.after }}
              </UiText>
            </div>
          </div>
        </div>
      </div>
      <UiText
        v-if="blocked || missingDependency || failed"
        variant="sm"
        class="text-destructive"
        role="alert"
      >
        {{
          i18n.t(
            blocked
              ? "ai.workspace.dirty"
              : missingDependency
                ? "ai.workspace.dependency"
                : "ai.workspace.failed",
          )
        }}
      </UiText>
      <Dialog.DialogFooter>
        <Button
          v-if="pending"
          variant="ghost"
          :disabled="busy"
          @click="
            rejectEdit(message);
            open = false;
          "
        >
          {{ i18n.t("ai.edit.reject") }}
        </Button>
        <Button
          variant="outline"
          :disabled="busy"
          @click="open = false"
        >
          {{ i18n.t("ai.edit.cancel") }}
        </Button>
        <Button
          :disabled="
            busy
              || message.rejected
              || blocked
              || missingDependency
              || !selected.length
          "
          @click="apply"
        >
          {{ i18n.t("ai.workspace.apply") }}
        </Button>
      </Dialog.DialogFooter>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
