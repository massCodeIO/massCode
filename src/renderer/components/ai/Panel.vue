<script setup lang="ts">
import type { AiVaultItem } from '~/shared/ai'
import { Button } from '@/components/ui/shadcn/button'
import { useAi } from '@/composables/ai/useAi'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useDateFormat } from '@/composables/useDateFormat'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { useResizeObserver } from '@vueuse/core'
import { Copy, Settings, SquarePen, X } from 'lucide-vue-next'

defineProps<{ embedded?: boolean }>()

const {
  settings,
  conversation,
  isStreaming,
  setOpen,
  clearConversation,
  retry,
  canRetry,
  refreshSettings,
} = useAi()
const taskState = computed(
  () => conversation.value?.messages.at(-1)?.taskState,
)
const isGenerating = computed(
  () => !taskState.value || taskState.value === 'working',
)
const messageReferences = computed(() => {
  const items: AiVaultItem[] = []
  const undoneKeys = new Set(
    (conversation.value?.messages ?? []).flatMap(message =>
      (message.workspaceCreations ?? []).flatMap(creation =>
        creation.items
          .filter(item => creation.undone.includes(item.operationIndex))
          .map(item => `${item.type}:${item.id}`),
      ),
    ),
  )
  return (conversation.value?.messages ?? []).map((message) => {
    items.push(...(message.attachments ?? []))
    const created = (message.workspaceCreations ?? []).flatMap(creation =>
      creation.items.filter(
        item => !creation.undone.includes(item.operationIndex),
      ),
    )
    const creationKeys = new Set(
      created.map(item => `${item.type}:${item.id}`),
    )
    for (const result of message.searchResults ?? [])
      items.push(...result.items)
    // This turn already presents creation links in its receipts. Later replies
    // still need these references, including after the user navigates elsewhere.
    const references = items.filter(
      item =>
        !creationKeys.has(`${item.type}:${item.id}`)
        && !undoneKeys.has(`${item.type}:${item.id}`),
    )
    items.push(...created)
    return references
  })
})
const messageUnlinkedNames = computed(() => {
  const undoneNames = new Set<string>()
  return (conversation.value?.messages ?? []).map((message) => {
    const receiptNames = new Set<string>()
    for (const creation of message.workspaceCreations ?? []) {
      for (const [index, change] of creation.proposal.changes.entries()) {
        if (!change.name)
          continue
        // Current receipts own these labels, even if another record has the
        // same name. A later successful recreation releases the tombstone.
        receiptNames.add(change.name)
        if (
          creation.applied.includes(index)
          && !creation.undone.includes(index)
        ) {
          undoneNames.delete(change.name)
        }
        else if (creation.undone.includes(index)) {
          undoneNames.add(change.name)
        }
      }
    }
    return [...new Set([...undoneNames, ...receiptNames])]
  })
})
const { formatDateTime } = useDateFormat()
const copy = useCopyToClipboard()
const profile = computed(
  () => settings.value?.profiles[settings.value.provider],
)
const ready = computed(() =>
  Boolean(
    profile.value?.model
    && (settings.value?.provider !== 'openai' || profile.value.hasKey),
  ),
)
const scroll = ref<HTMLElement>()
const messagesContent = ref<HTMLElement>()
const followBottom = ref(true)
function onScroll() {
  const el = scroll.value
  if (el)
    followBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60
}
// Markdown rendering, code block mounting and review controls can resize after
// the streamed text changes. Follow the rendered layout rather than raw tokens.
useResizeObserver(messagesContent, () => {
  if (followBottom.value)
    scroll.value?.scrollTo({ top: scroll.value.scrollHeight })
})
onMounted(() => {
  void refreshSettings().catch(() => {})
})
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col"
    :class="!embedded && 'pt-[var(--content-top-offset)]'"
  >
    <div
      v-if="!embedded"
      class="flex h-[calc(41px-var(--content-top-offset))] shrink-0 items-center justify-between gap-2 border-b px-3 pb-1"
    >
      <UiText
        variant="sm"
        weight="medium"
      >
        {{ i18n.t("ai.title") }}
      </UiText>
      <div class="flex gap-1">
        <UiActionButton
          :tooltip="i18n.t('ai.settings')"
          @click="router.push({ name: RouterName.preferencesAI })"
        >
          <Settings class="size-4" />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('action.close')"
          @click="setOpen(false)"
        >
          <X class="size-4" />
        </UiActionButton>
      </div>
    </div>
    <div class="shrink-0 space-y-2 px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <UiText
          variant="caption"
          muted
          class="block min-w-0 flex-1 break-words"
        >
          {{ settings ? i18n.t(`ai.providers.${settings.provider}`) : "" }} ·
          {{ profile?.model || i18n.t("ai.notConfigured") }}
        </UiText>
        <div class="flex shrink-0 gap-1">
          <UiActionButton
            :tooltip="i18n.t('ai.newChat')"
            @click="clearConversation"
          >
            <SquarePen class="size-4" />
          </UiActionButton>
          <UiActionButton
            v-if="embedded"
            :tooltip="i18n.t('ai.settings')"
            @click="router.push({ name: RouterName.preferencesAI })"
          >
            <Settings class="size-4" />
          </UiActionButton>
        </div>
      </div>
      <UiAlert
        v-if="!ready"
        variant="warning"
      >
        {{ i18n.t("ai.setupHint") }}
      </UiAlert>
    </div>
    <div
      ref="scroll"
      class="scrollbar min-h-0 flex-1 overflow-y-auto p-3"
      @scroll="onScroll"
    >
      <div
        ref="messagesContent"
        class="space-y-4"
      >
        <div
          v-for="(message, index) in conversation?.messages"
          :key="index"
          class="min-w-0 space-y-2 text-left"
          :class="
            message.role === 'user'
              ? 'ml-auto w-fit max-w-[90%]'
              : 'mr-auto w-full'
          "
        >
          <AiTaskStatus
            v-if="message.role === 'assistant'"
            :message="message"
          />
          <AiNativeActionReview
            v-for="action in message.nativeActions"
            :key="action.id"
            :message="message"
            :action="action"
          />
          <AiSearchResults
            v-for="(result, resultIndex) in message.searchResults"
            :key="resultIndex"
            :result="result"
          />
          <AiCreationResult
            v-for="creation in message.workspaceCreations"
            :key="creation.proposal.id"
            :message="message"
            :creation="creation"
          />
          <template v-if="message.httpProposal">
            <AiMessage
              v-if="message.httpProposal.analysis"
              :content="message.httpProposal.analysis"
              :items="messageReferences[index]"
              :unlinked-names="messageUnlinkedNames[index]"
            />
            <AiHttpChecks :proposal="message.httpProposal" />
          </template>
          <AiMessage
            v-else-if="message.role === 'assistant'"
            :content="message.content"
            :items="messageReferences[index]"
            :unlinked-names="messageUnlinkedNames[index]"
          />
          <UiText
            v-else
            as="div"
            variant="sm"
            class="bg-muted ml-auto w-fit max-w-full rounded-lg px-3 py-2 break-words whitespace-pre-wrap select-text"
          >
            {{ message.content }}
          </UiText>
          <AiHttpActionReview
            v-for="action in message.httpActions"
            :key="action.id"
            :message="message"
            :action="action"
          />
          <UiText
            v-if="message.proposalSummary && !message.content"
            as="p"
            variant="sm"
          >
            {{ message.proposalSummary }}
          </UiText>
          <AiUserContext
            v-if="message.role === 'user'"
            :message="message"
          />
          <UiText
            v-if="message.status === 'cancelled'"
            variant="caption"
            muted
          >
            {{ i18n.t("ai.cancelled") }}
          </UiText>
          <div
            v-if="
              message.role === 'assistant'
                && (message.content
                  || message.edit
                  || message.httpProposal
                  || message.httpActions?.length
                  || message.dataActions?.length
                  || message.nativeActions?.length
                  || message.taskMutations?.length
                  || message.workspaceProposal
                  || message.workspaceCreations?.length
                  || canRetry(message))
            "
            class="flex flex-wrap items-center gap-2"
          >
            <UiActionButton
              v-if="message.content"
              :tooltip="i18n.t('menu:edit.copy')"
              @click="copy(message.content)"
            >
              <Copy class="size-3" />
            </UiActionButton>
            <AiTaskUndo :message="message" />
            <AiWorkspaceReview
              v-if="message.workspaceProposal"
              :message="message"
            />
            <UiStatus
              v-for="action in message.dataActions"
              :key="action.id"
              :state="action.status"
            >
              {{ i18n.t(`ai.dataActions.${action.kind}`) }}:
              {{ i18n.t(`ai.dataActions.${action.status}`) }}
            </UiStatus>
            <AiHttpReview
              v-if="message.httpProposal"
              :message="message"
            />
            <AiEditReview
              v-if="
                message.edit
                  && !message.workspaceProposal
                  && !message.httpProposal
              "
              :message="message"
            />
            <Button
              v-if="canRetry(message)"
              variant="outline"
              size="sm"
              @click="retry(message)"
            >
              {{ i18n.t("ai.retry") }}
            </Button>
            <UiText
              v-if="message.createdAt"
              as="time"
              variant="caption"
              muted
              :datetime="new Date(message.createdAt).toISOString()"
            >
              {{ formatDateTime(message.createdAt) }}
            </UiText>
          </div>
        </div>
        <UiText
          v-if="conversation?.historyOmitted"
          as="p"
          variant="caption"
          muted
          role="status"
        >
          {{ i18n.t("ai.historyOmitted") }}
        </UiText>
        <UiText
          v-if="isStreaming"
          as="p"
          variant="caption"
          :shimmer="isGenerating"
          muted
          role="status"
        >
          {{ i18n.t(isGenerating ? "ai.generating" : `ai.task.${taskState}`) }}
        </UiText>
        <UiAlert
          v-if="conversation?.error"
          variant="error"
        >
          {{ i18n.t(`ai.errors.${conversation.error}`) }}
          <UiText
            v-if="conversation.diagnostic"
            as="pre"
            variant="caption"
            mono
            muted
            class="border-destructive/15 mt-2 border-t pt-2 break-words whitespace-pre-wrap"
          >
            {{ conversation.diagnostic }}
          </UiText>
        </UiAlert>
      </div>
    </div>
    <AiComposer
      :ready="ready"
      @submit="followBottom = true"
    />
  </div>
</template>
