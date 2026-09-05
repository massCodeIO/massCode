<script setup lang="ts">
import { useHttpWebSocket } from '@/composables/spaces/http/useHttpWebSocket'
import { i18n } from '@/electron'
import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-vue-next'

const { view, error, clear } = useHttpWebSocket()
const log = useTemplateRef<HTMLElement>('log')
const follow = ref(true)
watch(
  () => view.value?.lastId,
  async () => {
    if (!follow.value)
      return
    await nextTick()
    if (log.value)
      log.value.scrollTop = log.value.scrollHeight
  },
)
function onScroll() {
  const el = log.value
  if (el)
    follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 24
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-border flex items-center gap-3 border-b px-3 py-1">
      <UiText
        variant="sm"
        weight="medium"
      >
        {{ i18n.t("spaces.http.websocket.messages") }}
      </UiText>
      <UiText
        variant="caption"
        class="flex-1"
        :class="
          view?.state === 'open' ? 'text-success' : 'text-muted-foreground'
        "
      >
        {{ i18n.t(`spaces.http.websocket.states.${view?.state ?? "closed"}`)
        }}<template v-if="view?.closeCode">
          · {{ view.closeCode }}
        </template>
      </UiText>
      <UiActionButton
        :tooltip="i18n.t('spaces.http.websocket.clear')"
        :disabled="!view?.messages.length"
        @click="clear"
      >
        <Trash2 class="size-4" />
      </UiActionButton>
    </div>
    <UiText
      v-if="error || view?.error"
      variant="xs"
      class="text-destructive border-b px-3 py-2"
      role="alert"
    >
      {{
        i18n.t(`spaces.http.websocket.errors.${error ?? view?.error}`, {
          status: view?.handshakeStatus,
        })
      }}
    </UiText>
    <UiText
      variant="caption"
      muted
      class="border-b px-3 py-2"
    >
      {{ i18n.t("spaces.http.websocket.logHint") }}
    </UiText>
    <UiText
      v-if="view?.dropped"
      variant="caption"
      muted
      class="px-3 py-1"
    >
      {{ i18n.t("spaces.http.websocket.dropped", { count: view.dropped }) }}
    </UiText>
    <div
      ref="log"
      class="scrollbar min-h-0 flex-1 overflow-y-auto"
      @scroll="onScroll"
    >
      <UiText
        v-if="!view?.messages.length"
        as="p"
        variant="sm"
        muted
        class="p-3"
      >
        {{ i18n.t("spaces.http.websocket.empty") }}
      </UiText>
      <div
        v-for="item in view?.messages"
        :key="item.id"
        class="border-border space-y-1 border-b px-3 py-2"
      >
        <div class="flex items-center gap-2">
          <ArrowDownLeft
            v-if="item.direction === 'incoming'"
            class="text-success size-4"
          /><ArrowUpRight
            v-else
            class="text-muted-foreground size-4"
          />
          <UiText
            variant="caption"
            weight="medium"
          >
            {{ i18n.t(`spaces.http.websocket.${item.direction}`) }}
          </UiText>
          <UiText
            variant="caption"
            muted
            class="flex-1"
          >
            {{ new Date(item.time).toLocaleTimeString() }}
          </UiText>
          <UiText
            variant="caption"
            muted
          >
            {{ item.bytes }} B
          </UiText>
          <UiText
            v-if="item.kind === 'binary'"
            variant="caption"
            muted
          >
            {{ i18n.t("spaces.http.websocket.binary") }}
          </UiText>
        </div>
        <UiText
          as="pre"
          variant="xs"
          class="font-mono break-all whitespace-pre-wrap select-text"
        >
          {{ item.text }}
        </UiText>
        <UiText
          v-if="item.truncated"
          variant="caption"
          muted
        >
          {{ i18n.t("spaces.http.editor.response.truncated") }}
        </UiText>
      </div>
    </div>
  </div>
</template>
