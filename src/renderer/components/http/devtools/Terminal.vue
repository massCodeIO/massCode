<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useHttpTerminal } from '@/composables/spaces/http/devtools/useHttpTerminal'
import { i18n } from '@/electron'
import { useResizeObserver } from '@vueuse/core'
import { Plus, SquareTerminal, X } from 'lucide-vue-next'

const props = defineProps<{ visible: boolean }>()
const {
  sessions,
  activeId,
  error,
  loading,
  init,
  create,
  mount,
  resize,
  clear,
  close,
} = useHttpTerminal()
const host = ref<HTMLElement>()
useResizeObserver(host, resize)
watch(
  [activeId, () => props.visible, () => sessions.value.length],
  async () => {
    await nextTick()
    if (props.visible && host.value)
      mount(host.value)
  },
)
watch(
  () => props.visible,
  async (visible) => {
    if (!visible)
      return
    await init()
    if (!props.visible)
      return
    if (!sessions.value.length && !loading.value)
      await create()
    if (props.visible && host.value)
      mount(host.value)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex h-8 shrink-0 items-center gap-2 border-b px-2">
      <UiText
        variant="xs"
        muted
      >
        {{ i18n.t("spaces.http.devtools.sessions") }}
      </UiText>
      <div class="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        :disabled="!activeId"
        @click="clear"
      >
        {{ i18n.t("spaces.http.devtools.clear") }}
      </Button>
      <UiActionButton
        :tooltip="i18n.t('spaces.http.devtools.newTerminal')"
        :aria-label="i18n.t('spaces.http.devtools.newTerminal')"
        :disabled="loading"
        @click="create"
      >
        <Plus />
      </UiActionButton>
    </div>
    <UiText
      v-if="error"
      variant="xs"
      as="div"
      class="text-destructive shrink-0 border-b px-3 py-2 break-words"
    >
      {{ error }}
    </UiText>
    <div class="flex min-h-0 flex-1">
      <div class="relative min-h-0 min-w-0 flex-1">
        <div
          v-if="!sessions.length"
          class="flex h-full flex-col items-center justify-center gap-3"
        >
          <SquareTerminal class="text-muted-foreground size-6" /><Button
            variant="secondary"
            :disabled="loading"
            @click="create"
          >
            {{ i18n.t("spaces.http.devtools.newTerminal") }}
          </Button>
        </div>
        <div
          v-show="activeId"
          ref="host"
          class="bg-background text-foreground absolute inset-0 overflow-hidden p-2"
        />
      </div>
      <aside
        v-if="sessions.length"
        class="scrollbar w-40 shrink-0 overflow-auto border-l p-1"
      >
        <div
          v-for="session in sessions"
          :key="session.id"
          class="flex items-center rounded-md"
          :class="{ 'bg-accent': activeId === session.id }"
        >
          <Button
            variant="ghost"
            size="sm"
            class="min-w-0 flex-1 justify-start"
            :title="session.cwd"
            @click="activeId = session.id"
          >
            <UiText
              variant="xs"
              class="truncate"
            >
              {{ session.title }}
            </UiText><UiText
              v-if="session.exitCode !== undefined"
              variant="caption"
              muted
            >
              {{ session.exitCode }}
            </UiText>
          </Button>
          <UiActionButton
            :tooltip="i18n.t('spaces.http.devtools.removeTerminal')"
            :aria-label="i18n.t('spaces.http.devtools.removeTerminal')"
            @click="close(session.id)"
          >
            <X class="size-3" />
          </UiActionButton>
        </div>
      </aside>
    </div>
  </div>
</template>
