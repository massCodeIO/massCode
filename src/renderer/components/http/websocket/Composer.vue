<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { i18n } from '@/electron'
import { Send } from 'lucide-vue-next'

const { currentDraft } = useHttpRequests()
const { view, sending, send } = useHttpWebSocket()
const message = computed({
  get: () => currentDraft.value?.body ?? '',
  set: (value: string | number) => {
    if (currentDraft.value)
      currentDraft.value.body = String(value)
  },
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <UiText
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.websocket.messageHint") }}
    </UiText>
    <Textarea
      v-model="message"
      class="scrollbar min-h-20 flex-1 resize-none font-mono"
      :aria-label="i18n.t('spaces.http.websocket.message')"
    />
    <div class="flex justify-end">
      <Button
        variant="ghost"
        :disabled="view?.state !== 'open' || sending"
        @click="send"
      >
        <Send class="size-4" />{{ i18n.t("spaces.http.websocket.send") }}
      </Button>
    </div>
  </div>
</template>
