<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useAi } from '@/composables/ai/useAi'
import { i18n, store } from '@/electron'
import { openSpaceTarget } from '@/ipc/listeners/deepLinks'
import { RouterName } from '@/router'
import { getSpaceDefinitions } from '@/spaceDefinitions'
import { isMac } from '@/utils'
import { MessageSquare, Settings } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import packageJson from '../../../../package.json'

const route = useRoute()
const { open: aiOpen, openAndFocus: openAi } = useAi()

const spaces = computed(() => {
  return getSpaceDefinitions().map(space => ({
    ...space,
    active: space.isActive(route.name),
  }))
})

const supportsAi = computed(() =>
  spaces.value.some(
    space => space.active && ['code', 'notes', 'http'].includes(space.id),
  ),
)

watch(
  () => spaces.value.find(s => s.active)?.id,
  (spaceId) => {
    if (spaceId) {
      store.app.set('activeSpaceId', spaceId)
    }
  },
)
</script>

<template>
  <nav
    class="flex h-full flex-col items-center px-2 pb-3"
    :class="isMac ? 'pt-[calc(var(--content-top-offset)+8px)]' : 'pt-3'"
    :aria-label="i18n.t('spaces.label')"
  >
    <div class="flex w-full flex-col gap-1">
      <RouterLink
        v-for="space in spaces"
        :key="space.id"
        custom
        :to="space.to"
      >
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <button
              type="button"
              class="text-muted-foreground flex h-11.5 w-full cursor-default items-center justify-center rounded-lg px-2 py-2 transition-colors"
              :class="
                space.active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent-hover'
              "
              :aria-label="space.label"
              :aria-current="space.active ? 'page' : undefined"
              @click="openSpaceTarget(space.id)"
            >
              <component
                :is="space.icon"
                class="size-5 shrink-0"
              />
            </button>
          </Tooltip.TooltipTrigger>
          <Tooltip.TooltipContent side="right">
            {{ space.tooltip }}
          </Tooltip.TooltipContent>
        </Tooltip.Tooltip>
      </RouterLink>
    </div>
    <div
      class="mt-auto flex min-h-0 flex-1 flex-col items-center justify-end gap-2 overflow-hidden pb-2"
    >
      <UiActionButton
        v-if="supportsAi"
        :tooltip="i18n.t('ai.title')"
        shortcut="CommandOrControl+L"
        :aria-pressed="aiOpen"
        @click="openAi"
      >
        <MessageSquare class="size-4" />
      </UiActionButton>
      <SpaceRailCloudDownloads />
      <SpaceRailUnsponsored />
      <RouterLink
        v-slot="{ navigate }"
        custom
        :to="{ name: RouterName.preferences }"
      >
        <UiActionButton
          :tooltip="i18n.t('preferences:label')"
          shortcut="CommandOrControl+,"
          @click="navigate"
        >
          <Settings class="size-4" />
        </UiActionButton>
      </RouterLink>
      <UiText
        as="div"
        variant="caption"
        weight="medium"
        class="text-muted-foreground/55 leading-none select-none"
      >
        v{{ packageJson.version }}
      </UiText>
    </div>
  </nav>
</template>
