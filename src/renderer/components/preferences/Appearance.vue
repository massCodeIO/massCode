<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { DockBadgeSource } from '~/main/store/types'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { useSonner, useTheme } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { isMac } from '@/utils'

const { currentThemeId, customThemes, loadCustomThemes, setTheme } = useTheme()
const { sonner } = useSonner()

interface DockBadgeRefreshResult {
  applied: boolean
  count: number
}

const dockBadgeSource = ref<DockBadgeSource>(
  store.preferences.get<DockBadgeSource>('appearance.dockBadgeSource')
  || 'none',
)

const dockBadgeOptions: Array<{ id: DockBadgeSource, label: string }> = [
  {
    id: 'none',
    label: i18n.t('preferences:appearance.dockBadge.none'),
  },
  {
    id: 'codeInbox',
    label: i18n.t('preferences:appearance.dockBadge.codeInbox'),
  },
  {
    id: 'notesInbox',
    label: i18n.t('preferences:appearance.dockBadge.notesInbox'),
  },
  {
    id: 'tasksDue',
    label: i18n.t('preferences:appearance.dockBadge.tasksDue'),
  },
]
const dockBadgeSources = new Set<DockBadgeSource>(
  dockBadgeOptions.map(option => option.id),
)

const builtInThemes = [
  {
    id: 'light',
    label: i18n.t('preferences:appearance.theme.light'),
  },
  {
    id: 'dark',
    label: i18n.t('preferences:appearance.theme.dark'),
  },
  {
    id: 'auto',
    label: i18n.t('preferences:appearance.theme.system'),
  },
]

const customDarkThemes = computed(() => {
  return customThemes.value.filter(theme => theme.type === 'dark')
})

const customLightThemes = computed(() => {
  return customThemes.value.filter(theme => theme.type === 'light')
})

async function onThemeChange(value: AcceptableValue) {
  if (typeof value === 'string') {
    await setTheme(value)
  }
}

async function onDockBadgeSourceChange(value: AcceptableValue) {
  if (
    typeof value !== 'string'
    || !dockBadgeSources.has(value as DockBadgeSource)
  ) {
    return
  }

  const source = value as DockBadgeSource
  dockBadgeSource.value = source
  store.preferences.set('appearance.dockBadgeSource', source)
  const result = (await ipc.invoke(
    'system:refresh-dock-badge',
    null,
  )) as DockBadgeRefreshResult

  if (source !== 'none' && !result.applied) {
    sonner({
      message: i18n.t('preferences:appearance.dockBadge.permissionDenied'),
      type: 'warning',
    })
  }
}

async function openThemesDir() {
  await ipc.invoke('theme:open-dir', null)
}

async function createThemeTemplate() {
  await ipc.invoke('theme:create-template', null)
  await loadCustomThemes()
}

void loadCustomThemes()
</script>

<template>
  <div>
    <UiMenuFormSection :label="i18n.t('preferences:appearance.label')">
      <UiMenuFormItem :label="i18n.t('preferences:appearance.theme.label')">
        <Select.Select
          :model-value="currentThemeId"
          @update:model-value="onThemeChange"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectGroup>
              <Select.SelectLabel>
                {{ i18n.t("preferences:appearance.theme.builtIn") }}
              </Select.SelectLabel>
              <Select.SelectItem
                v-for="theme in builtInThemes"
                :key="theme.id"
                :value="theme.id"
              >
                {{ theme.label }}
              </Select.SelectItem>
            </Select.SelectGroup>

            <template v-if="customThemes.length">
              <Select.SelectSeparator />

              <Select.SelectGroup v-if="customDarkThemes.length">
                <Select.SelectLabel>
                  {{
                    `${i18n.t("preferences:appearance.theme.custom")} · ${i18n.t("preferences:appearance.theme.dark")}`
                  }}
                </Select.SelectLabel>
                <Select.SelectItem
                  v-for="theme in customDarkThemes"
                  :key="theme.id"
                  :value="theme.id"
                >
                  {{ theme.name }}
                </Select.SelectItem>
              </Select.SelectGroup>

              <Select.SelectGroup v-if="customLightThemes.length">
                <Select.SelectLabel>
                  {{
                    `${i18n.t("preferences:appearance.theme.custom")} · ${i18n.t("preferences:appearance.theme.light")}`
                  }}
                </Select.SelectLabel>
                <Select.SelectItem
                  v-for="theme in customLightThemes"
                  :key="theme.id"
                  :value="theme.id"
                >
                  {{ theme.name }}
                </Select.SelectItem>
              </Select.SelectGroup>
            </template>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>

      <UiMenuFormItem
        v-if="isMac"
        :label="i18n.t('preferences:appearance.dockBadge.label')"
      >
        <Select.Select
          :model-value="dockBadgeSource"
          @update:model-value="onDockBadgeSourceChange"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="option in dockBadgeOptions"
              :key="option.id"
              :value="option.id"
            >
              {{ option.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>

      <UiMenuFormItem :label="i18n.t('preferences:appearance.theme.themesDir')">
        <template #description>
          {{ i18n.t("preferences:appearance.theme.dirDescription") }}
        </template>
        <template #actions>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="openThemesDir"
            >
              {{ i18n.t("preferences:appearance.theme.openDir") }}
            </Button>
            <Button @click="createThemeTemplate">
              {{ i18n.t("preferences:appearance.theme.createTemplate") }}
            </Button>
          </div>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
