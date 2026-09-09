<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useResizeHandle } from '@/composables/useResizeHandle'
import { i18n } from '@/electron'
import { useElementSize } from '@vueuse/core'
import {
  Maximize2,
  Minimize2,
  SquareTerminal,
  TextSearch,
  X,
} from 'lucide-vue-next'

const active = ref<'console' | 'terminal'>('console')
const open = ref(false)
const maximized = ref(false)
const height = ref(240)
const root = ref<HTMLElement>()
const handle = ref<HTMLElement>()
const { height: rootHeight } = useElementSize(root)
const panelHeight = computed(() =>
  Math.min(height.value, Math.max(140, (rootHeight.value || 700) - 240)),
)
useResizeHandle(handle, {
  direction: 'vertical',
  onMove(delta) {
    height.value = Math.min(
      Math.max(140, height.value - delta),
      Math.max(140, (rootHeight.value || 700) - 240),
    )
  },
})
function toggle(tab: 'console' | 'terminal') {
  open.value = active.value === tab ? !open.value : true
  active.value = tab
  if (!open.value)
    maximized.value = false
}
</script>

<template>
  <div
    ref="root"
    class="flex h-full min-h-0 min-w-0 flex-col"
  >
    <div
      v-show="!open || !maximized"
      class="min-h-0 flex-1 overflow-hidden"
    >
      <slot />
    </div>
    <div
      v-if="open && !maximized"
      ref="handle"
      class="bg-border hover:bg-primary relative z-20 h-px shrink-0 cursor-row-resize after:absolute after:inset-x-0 after:-top-1 after:h-2"
    />
    <Tabs.Tabs
      v-show="open"
      v-model="active"
      as="section"
      :style="maximized ? undefined : { height: `${panelHeight}px` }"
      class="flex min-h-0 shrink-0 flex-col gap-0"
      :class="{ 'flex-1 pt-[var(--content-top-offset)]': maximized }"
    >
      <div class="flex h-9 shrink-0 items-center gap-1 border-b px-2">
        <Tabs.TabsList>
          <Tabs.TabsTrigger
            v-for="tab in ['console', 'terminal'] as const"
            :key="tab"
            :value="tab"
          >
            {{ i18n.t(`spaces.http.devtools.${tab}`) }}
          </Tabs.TabsTrigger>
        </Tabs.TabsList>
        <div class="flex-1" />
        <UiActionButton
          :tooltip="
            i18n.t(
              maximized
                ? 'spaces.http.devtools.restore'
                : 'spaces.http.devtools.maximize',
            )
          "
          @click="maximized = !maximized"
        >
          <Minimize2 v-if="maximized" /><Maximize2 v-else />
        </UiActionButton>
        <UiActionButton
          :tooltip="i18n.t('spaces.http.devtools.close')"
          @click="
            open = false;
            maximized = false;
          "
        >
          <X />
        </UiActionButton>
      </div>
      <Tabs.TabsContent
        v-show="active === 'console'"
        value="console"
        force-mount
        class="flex min-h-0 flex-col"
      >
        <HttpDevtoolsConsole />
      </Tabs.TabsContent>
      <Tabs.TabsContent
        v-show="active === 'terminal'"
        value="terminal"
        force-mount
        class="flex min-h-0 flex-col"
      >
        <HttpDevtoolsTerminal :visible="open && active === 'terminal'" />
      </Tabs.TabsContent>
    </Tabs.Tabs>
    <footer class="flex h-7 shrink-0 items-center gap-1 border-t px-2">
      <Button
        variant="ghost"
        size="sm"
        :aria-expanded="open && active === 'console'"
        @click="toggle('console')"
      >
        <TextSearch class="size-3.5" /><UiText variant="xs">
          {{ i18n.t("spaces.http.devtools.console") }}
        </UiText>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :aria-expanded="open && active === 'terminal'"
        @click="toggle('terminal')"
      >
        <SquareTerminal class="size-3.5" /><UiText variant="xs">
          {{ i18n.t("spaces.http.devtools.terminal") }}
        </UiText>
      </Button>
      <div class="flex-1" />
      <HttpDevtoolsCookies />
    </footer>
  </div>
</template>
