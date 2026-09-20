<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { useAi } from '@/composables/ai/useAi'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { useResizeObserver } from '@vueuse/core'
import { Copy, Settings, X } from 'lucide-vue-next'

const {
  settings,
  context,
  contextMode,
  conversation,
  isStreaming,
  setOpen,
  send,
  cancel,
  clearConversation,
  retry,
  canRetry,
  refreshSettings,
} = useAi()
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
const contextText = computed(() =>
  contextMode.value === 'selection'
    ? context.value?.selection
    : context.value?.text,
)
const draft = computed({
  get: () => conversation.value?.draft ?? '',
  set: (value: string | number) => {
    if (conversation.value)
      conversation.value.draft = String(value)
  },
})
const canSend = computed(
  () => ready.value && Boolean(contextText.value?.trim()) && !isStreaming.value,
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
function submit(prompt = String(draft.value), proposeEdit = false) {
  if (!canSend.value)
    return
  followBottom.value = true
  void send(prompt, proposeEdit)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
onMounted(() => {
  void refreshSettings().catch(() => {})
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col pt-[var(--content-top-offset)]">
    <div
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
    <div class="space-y-2 border-b p-3">
      <UiText
        variant="caption"
        muted
        class="block break-all"
      >
        {{ settings ? i18n.t(`ai.providers.${settings.provider}`) : "" }} ·
        {{ profile?.model || i18n.t("ai.notConfigured") }}
      </UiText>
      <UiText
        v-if="!ready"
        variant="sm"
        class="block"
      >
        {{ i18n.t("ai.setupHint") }}
      </UiText>
      <template v-if="context">
        <Select.Select v-model="contextMode">
          <Select.SelectTrigger :aria-label="i18n.t('ai.context')">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              value="selection"
              :disabled="!context.selection"
            >
              {{ i18n.t("ai.selection") }}
            </Select.SelectItem>
            <Select.SelectItem value="fragment">
              {{ i18n.t("ai.fragment") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <details>
          <summary class="cursor-pointer">
            <UiText variant="caption">
              {{ i18n.t("ai.previewContext") }}
            </UiText>
          </summary>
          <UiText
            as="pre"
            variant="xs"
            mono
            class="scrollbar mt-2 max-h-40 overflow-auto break-words whitespace-pre-wrap"
          >
            {{ contextText }}
          </UiText>
        </details>
      </template>
      <UiText
        v-else
        variant="sm"
        muted
      >
        {{ i18n.t("ai.selectFragment") }}
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
        <UiText
          v-if="!conversation?.messages.length"
          as="p"
          variant="sm"
          muted
        >
          {{ i18n.t("ai.intro") }}
        </UiText>
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
          <div
            v-if="message.content && message.role === 'assistant'"
            class="flex justify-end"
          >
            <UiActionButton
              :tooltip="i18n.t('action.copy')"
              @click="copy(message.content)"
            >
              <Copy class="size-3" />
            </UiActionButton>
          </div>
          <AiMessage
            v-if="message.role === 'assistant'"
            :content="message.content"
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
          <AiEditReview
            v-if="message.edit"
            :message="message"
          />
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
        </div>
        <Button
          v-if="
            conversation?.messages.at(-1)
              && canRetry(conversation.messages.at(-1)!)
          "
          variant="outline"
          size="sm"
          @click="retry(conversation!.messages.at(-1)!)"
        >
          {{ i18n.t("ai.retry") }}
        </Button>
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
        </UiText>
      </div>
    </div>
    <div class="space-y-2 border-t p-3">
      <div
        v-if="!conversation?.messages.length"
        class="flex flex-wrap gap-1"
      >
        <Button
          v-for="action in ['explain', 'findProblem', 'improve']"
          :key="action"
          variant="outline"
          size="sm"
          :disabled="!canSend"
          @click="submit(i18n.t(`ai.prompts.${action}`))"
        >
          {{ i18n.t(`ai.actions.${action}`) }}
        </Button>
      </div>
      <UiInput
        v-model="draft"
        type="textarea"
        :rows="3"
        :placeholder="i18n.t('ai.placeholder')"
        :aria-label="i18n.t('ai.placeholder')"
        :disabled="!context"
        @keydown="onKeydown"
      />
      <div class="flex justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          :disabled="!conversation?.messages.length || isStreaming"
          @click="clearConversation"
        >
          {{ i18n.t("ai.newChat") }}
        </Button>
        <Button
          v-if="isStreaming"
          variant="outline"
          size="sm"
          @click="cancel"
        >
          {{ i18n.t("ai.stop") }}
        </Button>
        <Button
          v-else
          size="sm"
          :disabled="!canSend || !String(draft).trim()"
          @click="submit()"
        >
          {{ i18n.t("ai.send") }}
        </Button>
      </div>
      <UiText
        variant="xs"
        muted
        class="block"
      >
        {{ i18n.t("ai.sessionHint") }}
      </UiText>
    </div>
  </div>
</template>
