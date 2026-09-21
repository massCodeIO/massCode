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
const messageReferences = computed(() => {
  const items: AiVaultItem[] = []
  return (conversation.value?.messages ?? []).map((message) => {
    items.push(...(message.attachments ?? []))
    for (const result of message.searchResults ?? [])
      items.push(...result.items)
    return [...items]
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
    <div class="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
      <UiText
        variant="caption"
        muted
        class="block break-all"
      >
        {{ settings ? i18n.t(`ai.providers.${settings.provider}`) : "" }} ·
        {{ profile?.model || i18n.t("ai.notConfigured") }}
      </UiText>
      <div class="flex shrink-0 gap-1">
        <UiActionButton
          :tooltip="i18n.t('ai.newChat')"
          :disabled="isStreaming"
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
      <UiText
        v-if="!ready"
        variant="sm"
        class="block"
      >
        {{ i18n.t("ai.setupHint") }}
      </UiText>
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
          <AiSearchResults
            v-for="(result, resultIndex) in message.searchResults"
            :key="resultIndex"
            :result="result"
          />
          <AiHttpChecks
            v-if="message.httpProposal"
            :proposal="message.httpProposal"
          />
          <AiMessage
            v-else-if="message.role === 'assistant'"
            :content="message.content"
            :items="messageReferences[index]"
          />
          <UiText
            v-else
            as="div"
            variant="sm"
            class="bg-muted rounded-lg px-3 py-2 break-words whitespace-pre-wrap select-text"
          >
            {{ message.content }}
          </UiText>
          <UiText
            v-if="message.proposalSummary && !message.content"
            as="p"
            variant="sm"
          >
            {{ message.proposalSummary }}
          </UiText>
          <div
            v-if="message.attachments?.length"
            class="flex flex-wrap justify-end gap-1"
          >
            <UiText
              v-for="item in message.attachments"
              :key="`${item.type}:${item.id}`"
              variant="xs"
              muted
              class="bg-muted rounded-md px-2 py-1"
            >
              {{ item.name }}
            </UiText>
          </div>
          <details v-if="message.context">
            <summary class="cursor-pointer text-right">
              <UiText
                variant="xs"
                muted
              >
                {{ i18n.t("ai.sentContext") }}
              </UiText>
            </summary>
            <UiText
              as="pre"
              variant="xs"
              mono
              class="scrollbar max-h-40 overflow-auto break-words whitespace-pre-wrap"
            >
              {{ message.context }}
            </UiText>
          </details>
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
            <AiHttpReview
              v-if="message.httpProposal"
              :message="message"
            />
            <AiEditReview
              v-if="message.edit"
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
          muted
          role="status"
        >
          {{ i18n.t("ai.generating") }}
        </UiText>
        <UiText
          v-if="conversation?.error"
          as="p"
          variant="sm"
          class="text-destructive"
          role="alert"
        >
          {{ i18n.t(`ai.errors.${conversation.error}`) }}
          <span
            v-if="conversation.diagnostic"
            class="block font-mono"
          >{{
            conversation.diagnostic
          }}</span>
        </UiText>
      </div>
    </div>
    <AiComposer
      :ready="ready"
      @submit="followBottom = true"
    />
  </div>
</template>
