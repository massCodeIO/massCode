<script setup lang="ts">
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { i18n, store } from '@/electron'
import { RouterName } from '@/router'
import { getSpaceDefinitions } from '@/spaceDefinitions'
import { isMac } from '@/utils'
import { Settings } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import packageJson from '../../../../package.json'

const route = useRoute()

const spaces = computed(() => {
  return getSpaceDefinitions().map(space => ({
    ...space,
    active: space.isActive(route.name),
  }))
})

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
        v-slot="{ navigate }"
        custom
        :to="space.to"
      >
        <Tooltip.Tooltip>
          <Tooltip.TooltipTrigger as-child>
            <button
              type="button"
              class="text-muted-foreground flex w-full cursor-default flex-col items-center gap-1 rounded-lg px-2 py-2 transition-colors"
              :class="
                space.active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent-hover'
              "
              @click="navigate"
            >
              <component
                :is="space.icon"
                class="h-4 w-4 shrink-0"
              />
              <UiText
                variant="caption"
                weight="medium"
                class="leading-none select-none"
              >
                {{ space.label }}
              </UiText>
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
      <SpaceRailUnsponsored />
      <RouterLink
        v-slot="{ navigate }"
        custom
        :to="{ name: RouterName.preferences }"
      >
        <UiActionButton
          :tooltip="i18n.t('preferences:label')"
          @click="navigate"
        >
          <Settings class="h-4 w-4" />
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
