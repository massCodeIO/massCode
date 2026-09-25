<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiResult } from '~/shared/ai'
import type { WorkspaceApplyResult } from '~/shared/aiWorkspace'
import { Button } from '@/components/ui/shadcn/button'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useAi } from '@/composables/ai/useAi'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n, ipc } from '@/electron'
import { workspaceReviewFields } from './workspaceReview'

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
const expanded = ref<number[]>([])
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
function toggleExpanded(index: number) {
  expanded.value = expanded.value.includes(index)
    ? expanded.value.filter(value => value !== index)
    : [...expanded.value, index]
}
function review() {
  selected.value = props.message.rejected
    ? []
    : proposal.value.changes
        .map((_, i) => i)
        .filter(i => !applied.value.includes(i) && !undone.value.includes(i))
  expanded.value = [selected.value[0] ?? 0]
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
    // IPC returns the cumulative receipt for this proposal.
    setWorkspaceItems(props.message, result.data.items)
    setWorkspaceApplied(props.message, result.data.applied)
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
    v-if="applied.length || !message.rejected"
    variant="outline"
    size="sm"
    @click="review"
  >
    {{ i18n.t("ai.workspace.review") }}
  </Button>
  <UiStatus
    v-if="message.applied"
    state="applied"
  >
    {{ i18n.t("ai.workspace.applied") }}
  </UiStatus>
  <UiStatus
    v-else-if="message.rejected"
    state="rejected"
  >
    {{
      i18n.t(
        applied.length ? "ai.workspace.remainingRejected" : "ai.edit.rejected",
      )
    }}
  </UiStatus>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      :zoom="false"
      class="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-5xl"
      @open-auto-focus="(event) => event.preventDefault()"
      @close-auto-focus="(event) => event.preventDefault()"
    >
      <Dialog.DialogHeader class="shrink-0">
        <Dialog.DialogTitle>
          {{ i18n.t("ai.workspace.review") }}
        </Dialog.DialogTitle>
        <Dialog.DialogDescription>
          {{ i18n.t("ai.workspace.description") }}
        </Dialog.DialogDescription>
      </Dialog.DialogHeader>
      <div class="scrollbar min-h-0 space-y-3 overflow-auto">
        <UiText
          as="p"
          variant="sm"
          class="break-words"
        >
          {{ proposal.summary }}
        </UiText>
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
            v-if="applied.includes(index) && !change.irreversible"
            variant="outline"
            size="sm"
            :disabled="busy || requestDirty"
            @click="undo(index)"
          >
            {{ i18n.t("ai.workspace.undo") }}
          </Button>
          <UiText
            v-if="change.irreversible"
            variant="sm"
            class="text-destructive"
          >
            {{
              i18n.t(
                `ai.workspace.consequences.${change.operation.kind === "item" ? "permanentDelete" : change.operation.kind}`,
              )
            }}
          </UiText>
          <Button
            variant="ghost"
            size="sm"
            :aria-expanded="expanded.includes(index)"
            @click="toggleExpanded(index)"
          >
            {{
              i18n.t(
                expanded.includes(index)
                  ? "ai.diff.hideDetails"
                  : "ai.diff.showDetails",
              )
            }}
          </Button>
          <div
            v-if="open && expanded.includes(index)"
            class="space-y-3"
          >
            <div
              v-for="field in workspaceReviewFields(
                change,
                i18n.t('ai.workspace.root'),
              )"
              :key="field.key"
              class="space-y-2"
            >
              <UiText
                variant="caption"
                muted
              >
                {{ i18n.t(`ai.workspace.fields.${field.key}`) }}
              </UiText>
              <AiTagsDiff
                v-if="field.key === 'tags'"
                :before="field.beforeTags"
                :after="field.afterTags"
              />
              <AiDiffViewer
                v-else-if="field.diff"
                :before="field.before"
                :after="field.after"
                :language="field.language"
              />
              <div
                v-else
                class="grid gap-2 sm:grid-cols-2"
              >
                <div
                  class="bg-diff-removed-bg min-w-0 space-y-1 rounded-md p-3"
                >
                  <UiText
                    variant="caption"
                    muted
                  >
                    {{ i18n.t("ai.workspace.before") }}
                  </UiText>
                  <UiText
                    as="div"
                    variant="sm"
                    class="break-words whitespace-pre-wrap"
                  >
                    {{ field.before }}
                  </UiText>
                </div>
                <div class="bg-diff-added-bg min-w-0 space-y-1 rounded-md p-3">
                  <UiText
                    variant="caption"
                    muted
                  >
                    {{ i18n.t("ai.workspace.after") }}
                  </UiText>
                  <UiText
                    as="div"
                    variant="sm"
                    class="break-words whitespace-pre-wrap"
                  >
                    {{ field.after }}
                  </UiText>
                </div>
              </div>
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
      <Dialog.DialogFooter class="shrink-0">
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
