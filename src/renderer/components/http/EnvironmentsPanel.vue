<script setup lang="ts">
import { useHttpEnvironments } from '@/composables'
import { i18n } from '@/electron'
import { Check, Settings2 } from 'lucide-vue-next'

const { environments, activeEnvironmentId, setActiveHttpEnvironment }
  = useHttpEnvironments()

const isManagerOpen = ref(false)

async function onSelectEnvironment(id: number | null) {
  if (activeEnvironmentId.value === id)
    return
  await setActiveHttpEnvironment(id)
}

function openManager() {
  isManagerOpen.value = true
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <SidebarSectionHeader :title="i18n.t('spaces.http.environments.title')">
      <template #action>
        <UiActionButton
          :tooltip="i18n.t('spaces.http.environments.manage')"
          @click="openManager"
        >
          <Settings2 class="size-4" />
        </UiActionButton>
      </template>
    </SidebarSectionHeader>

    <div class="scrollbar min-h-0 flex-1 overflow-y-auto px-0.5 pb-1">
      <button
        type="button"
        class="hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md px-2 py-px text-left"
        :class="{ 'bg-accent': activeEnvironmentId === null }"
        @click="onSelectEnvironment(null)"
      >
        <span class="text-muted-foreground truncate">
          {{ i18n.t("spaces.http.environments.none") }}
        </span>
        <Check
          v-if="activeEnvironmentId === null"
          class="size-3.5 flex-shrink-0"
        />
      </button>

      <div
        v-if="environments.length === 0"
        class="text-muted-foreground px-2 py-2 text-xs"
      >
        {{ i18n.t("spaces.http.environments.empty") }}
      </div>

      <button
        v-for="env in environments"
        :key="env.id"
        type="button"
        class="hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md px-2 py-px text-left"
        :class="{ 'bg-accent': activeEnvironmentId === env.id }"
        @click="onSelectEnvironment(env.id)"
      >
        <span class="truncate">{{ env.name }}</span>
        <Check
          v-if="activeEnvironmentId === env.id"
          class="size-3.5 flex-shrink-0"
        />
      </button>
    </div>

    <HttpEnvironmentManagerDialog v-model:open="isManagerOpen" />
  </div>
</template>
