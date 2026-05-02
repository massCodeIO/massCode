<script setup lang="ts">
import * as Popover from '@/components/ui/shadcn/popover'
import { useHttpEnvironments } from '@/composables'
import { i18n } from '@/electron'
import { Check, Globe, Settings2 } from 'lucide-vue-next'

const {
  environments,
  activeEnvironment,
  activeEnvironmentId,
  setActiveHttpEnvironment,
} = useHttpEnvironments()

const isPopoverOpen = ref(false)
const isManagerOpen = ref(false)

const tooltip = computed(() => {
  if (activeEnvironment.value) {
    return i18n.t('spaces.http.environments.activeTooltip', {
      name: activeEnvironment.value.name,
    })
  }
  return i18n.t('spaces.http.environments.selectTooltip')
})

async function onSelectEnvironment(id: number | null) {
  isPopoverOpen.value = false
  if (activeEnvironmentId.value === id)
    return
  await setActiveHttpEnvironment(id)
}

function onOpenManager() {
  isPopoverOpen.value = false
  isManagerOpen.value = true
}
</script>

<template>
  <Popover.Popover v-model:open="isPopoverOpen">
    <Popover.PopoverTrigger as-child>
      <UiActionButton :tooltip="tooltip">
        <Globe
          class="size-3.5"
          :class="{ 'text-primary': activeEnvironmentId !== null }"
        />
      </UiActionButton>
    </Popover.PopoverTrigger>
    <Popover.PopoverContent
      align="end"
      class="w-64 p-1"
    >
      <div
        class="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wider uppercase"
      >
        {{ i18n.t("spaces.http.environments.title") }}
      </div>
      <button
        type="button"
        class="hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm"
        @click="onSelectEnvironment(null)"
      >
        <span class="text-muted-foreground">
          {{ i18n.t("spaces.http.environments.none") }}
        </span>
        <Check
          v-if="activeEnvironmentId === null"
          class="size-3.5"
        />
      </button>
      <div
        v-if="environments.length === 0"
        class="text-muted-foreground px-2 py-1.5 text-xs"
      >
        {{ i18n.t("spaces.http.environments.empty") }}
      </div>
      <button
        v-for="env in environments"
        :key="env.id"
        type="button"
        class="hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm"
        @click="onSelectEnvironment(env.id)"
      >
        <span class="truncate">{{ env.name }}</span>
        <Check
          v-if="activeEnvironmentId === env.id"
          class="size-3.5 flex-shrink-0"
        />
      </button>
      <div class="bg-border my-1 h-px" />
      <button
        type="button"
        class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
        @click="onOpenManager"
      >
        <Settings2 class="size-3.5" />
        {{ i18n.t("spaces.http.environments.manage") }}
      </button>
    </Popover.PopoverContent>
  </Popover.Popover>
  <HttpEnvironmentManagerDialog v-model:open="isManagerOpen" />
</template>
