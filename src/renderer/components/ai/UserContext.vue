<script setup lang="ts">
import type { ChatMessage } from '@/composables/ai/useAi'
import type { AiVaultItem } from '~/shared/ai'
import { i18n } from '@/electron'

const props = defineProps<{ message: ChatMessage }>()
const items = computed(() => {
  const attached: AiVaultItem[] = [...(props.message.attachments ?? [])]
  const editor = props.message.editorSnapshot
  if (editor?.name) {
    const item: AiVaultItem
      = editor.space === 'code'
        ? { type: 'snippet', id: editor.snippetId, name: editor.name }
        : { type: 'note', id: editor.noteId, name: editor.name }
    if (
      !attached.some(
        existing => existing.type === item.type && existing.id === item.id,
      )
    ) {
      attached.push(item)
    }
  }
  return attached
})
const selectedCount = computed(
  () => props.message.workspaceContext?.selectedIds.length ?? 0,
)
</script>

<template>
  <div
    v-if="items.length || message.context || selectedCount"
    class="space-y-2"
  >
    <div
      v-if="items.length"
      class="flex flex-wrap justify-end gap-1"
    >
      <AiVaultLink
        v-for="item in items"
        :key="`${item.type}:${item.id}`"
        :item="item"
      />
    </div>
    <UiText
      v-if="selectedCount"
      as="p"
      variant="caption"
      muted
      class="text-right"
    >
      {{ i18n.t("ai.sentSelection", { count: selectedCount }) }}
    </UiText>
    <UiDisclosure v-if="message.context">
      <template #title>
        {{ i18n.t("ai.sentContext") }}
      </template>
      <UiText
        v-if="message.contextMode && message.contextMode !== 'none'"
        as="p"
        variant="caption"
        muted
      >
        {{
          i18n.t(
            message.contextMode === "selection"
              ? "ai.sentFragment"
              : "ai.sentWholeContent",
          )
        }}
      </UiText>
      <UiText
        as="pre"
        variant="xs"
        mono
        class="scrollbar max-h-40 overflow-auto break-words whitespace-pre-wrap select-text"
      >
        {{ message.context }}
      </UiText>
    </UiDisclosure>
  </div>
</template>
