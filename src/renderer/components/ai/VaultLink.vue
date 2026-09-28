<script setup lang="ts">
import type { AiVaultItem } from '~/shared/ai'
import { Button } from '@/components/ui/shadcn/button'
import { useAi } from '@/composables/ai/useAi'
import { i18n } from '@/electron'
import { openInternalTarget } from '@/ipc/listeners/deepLinks'
import { Code2, FileText, Send } from 'lucide-vue-next'

const props = defineProps<{ item: AiVaultItem }>()
const { unavailableWorkspaceItems } = useAi()
const unavailable = computed(() =>
  unavailableWorkspaceItems.value.has(`${props.item.type}:${props.item.id}`),
)
const icon = computed(() =>
  props.item.type === 'snippet'
    ? Code2
    : props.item.type === 'note'
      ? FileText
      : Send,
)
const opening = ref(false)
async function open() {
  if (opening.value || unavailable.value)
    return
  opening.value = true
  try {
    await openInternalTarget({
      type:
        props.item.type === 'http_request' ? 'http-request' : props.item.type,
      id: props.item.id,
    })
  }
  finally {
    opening.value = false
  }
}
</script>

<template>
  <UiText
    v-if="unavailable"
    variant="sm"
    muted
  >
    {{ item.name }}
  </UiText>
  <Button
    v-else
    variant="ghost"
    class="ai-vault-link"
    :disabled="opening"
    :title="`${i18n.t(`ai.itemTypes.${item.type}`)} · ${item.name}`"
    @click="open"
  >
    <component
      :is="icon"
      class="ai-vault-link-icon size-3"
    />
    <span class="break-words whitespace-normal">{{ item.name }}</span>
  </Button>
</template>

<style scoped>
.ai-vault-link {
  display: inline-block;
  height: auto;
  max-width: 100%;
  padding: 0.02rem 0.3rem;
  border-radius: 8px;
  border: 1px solid var(--internal-link-border);
  background-color: var(--internal-link-bg);
  color: var(--internal-link-fg);
  vertical-align: baseline;
  line-height: 1.1;
  font-size: 0.92em;
  font-weight: 400;
  font-style: normal;
}
.ai-vault-link-icon {
  display: inline-block;
  margin-inline-end: 0.24rem;
  vertical-align: -0.125em;
}
.ai-vault-link:hover {
  border-color: var(--internal-link-border-hover);
  background-color: var(--internal-link-bg-hover);
  color: var(--internal-link-fg-hover);
}
</style>
