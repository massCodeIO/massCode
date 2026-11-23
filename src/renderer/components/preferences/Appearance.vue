<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { DockBadgeSource } from '~/main/store/types'
import type { CommunityThemeSubmitResult } from '~/main/store/types/theme'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import * as Tabs from '@/components/ui/shadcn/tabs'
import { useSonner, useTheme } from '@/composables'
import { useDateFormat } from '@/composables/useDateFormat'
import { useDockBadgePreference } from '@/composables/useDockBadgePreference'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'
import { ExternalLink } from 'lucide-vue-next'
import { DATE_FORMATS } from '~/shared/dateFormat'

const { dateFormat, setDateFormat, formatDate } = useDateFormat()
const datePreview = new Date(2026, 10, 23)

const {
  currentThemeId,
  systemLightThemeId,
  systemDarkThemeId,
  customThemes,
  loadCustomThemes,
  setTheme,
  setSystemLightTheme,
  setSystemDarkTheme,
} = useTheme()
const { sonner } = useSonner()
const isCreatingThemeTemplate = ref(false)
const isSubmittingTheme = ref(false)
const activeTab = ref<'general' | 'community'>('general')

const isSystemThemeMode = computed(() => currentThemeId.value === 'auto')

const isCustomThemeActive = computed(() => {
  return customThemes.value.some(theme => theme.id === currentThemeId.value)
})

const { source: dockBadgeSource, setSource: setDockBadgeSource }
  = useDockBadgePreference()

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

async function onSystemLightThemeChange(value: AcceptableValue) {
  if (typeof value === 'string') {
    await setSystemLightTheme(value)
  }
}

async function onSystemDarkThemeChange(value: AcceptableValue) {
  if (typeof value === 'string') {
    await setSystemDarkTheme(value)
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
  const result = await setDockBadgeSource(source)

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
  if (isCreatingThemeTemplate.value) {
    return
  }

  isCreatingThemeTemplate.value = true

  try {
    await ipc.invoke('theme:create-template', null)
    await loadCustomThemes()
    sonner({
      message: i18n.t('preferences:appearance.theme.templateCreated'),
      type: 'success',
    })
  }
  catch {
    sonner({
      message: i18n.t('preferences:appearance.theme.templateCreateError'),
      type: 'error',
    })
  }
  finally {
    isCreatingThemeTemplate.value = false
  }
}

async function submitCurrentTheme() {
  if (isSubmittingTheme.value || !isCustomThemeActive.value) {
    return
  }

  isSubmittingTheme.value = true

  try {
    const result = await ipc.invoke<string, CommunityThemeSubmitResult>(
      'theme:community-prepare-submit',
      currentThemeId.value,
    )

    if (!result.ok) {
      sonner({
        message: result.error,
        type: 'error',
      })
      return
    }

    await ipc.invoke('system:open-external', result.url)
  }
  catch {
    sonner({
      message: i18n.t('preferences:appearance.theme.submitError'),
      type: 'error',
    })
  }
  finally {
    isSubmittingTheme.value = false
  }
}

void loadCustomThemes()
</script>

<template>
  <div>
    <Tabs.Tabs
      v-model="activeTab"
      class="space-y-4"
    >
      <Tabs.TabsList>
        <Tabs.TabsTrigger value="general">
          {{ i18n.t("preferences:appearance.tabs.general") }}
        </Tabs.TabsTrigger>
        <Tabs.TabsTrigger value="community">
          {{ i18n.t("preferences:appearance.tabs.community") }}
        </Tabs.TabsTrigger>
      </Tabs.TabsList>

      <Tabs.TabsContent value="general">
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
            v-if="isSystemThemeMode"
            :label="i18n.t('preferences:appearance.theme.systemLight')"
          >
            <Select.Select
              :model-value="systemLightThemeId"
              @update:model-value="onSystemLightThemeChange"
            >
              <Select.SelectTrigger class="w-64">
                <Select.SelectValue />
              </Select.SelectTrigger>
              <Select.SelectContent>
                <Select.SelectGroup>
                  <Select.SelectLabel>
                    {{ i18n.t("preferences:appearance.theme.builtIn") }}
                  </Select.SelectLabel>
                  <Select.SelectItem value="light">
                    {{ i18n.t("preferences:appearance.theme.light") }}
                  </Select.SelectItem>
                </Select.SelectGroup>

                <template v-if="customLightThemes.length">
                  <Select.SelectSeparator />
                  <Select.SelectGroup>
                    <Select.SelectLabel>
                      {{ i18n.t("preferences:appearance.theme.custom") }}
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
            <template #description>
              {{
                i18n.t("preferences:appearance.theme.systemLightDescription")
              }}
            </template>
          </UiMenuFormItem>

          <UiMenuFormItem
            v-if="isSystemThemeMode"
            :label="i18n.t('preferences:appearance.theme.systemDark')"
          >
            <Select.Select
              :model-value="systemDarkThemeId"
              @update:model-value="onSystemDarkThemeChange"
            >
              <Select.SelectTrigger class="w-64">
                <Select.SelectValue />
              </Select.SelectTrigger>
              <Select.SelectContent>
                <Select.SelectGroup>
                  <Select.SelectLabel>
                    {{ i18n.t("preferences:appearance.theme.builtIn") }}
                  </Select.SelectLabel>
                  <Select.SelectItem value="dark">
                    {{ i18n.t("preferences:appearance.theme.dark") }}
                  </Select.SelectItem>
                </Select.SelectGroup>

                <template v-if="customDarkThemes.length">
                  <Select.SelectSeparator />
                  <Select.SelectGroup>
                    <Select.SelectLabel>
                      {{ i18n.t("preferences:appearance.theme.custom") }}
                    </Select.SelectLabel>
                    <Select.SelectItem
                      v-for="theme in customDarkThemes"
                      :key="theme.id"
                      :value="theme.id"
                    >
                      {{ theme.name }}
                    </Select.SelectItem>
                  </Select.SelectGroup>
                </template>
              </Select.SelectContent>
            </Select.Select>
            <template #description>
              {{ i18n.t("preferences:appearance.theme.systemDarkDescription") }}
            </template>
          </UiMenuFormItem>

          <UiMenuFormItem
            :label="i18n.t('preferences:appearance.dateFormat.label')"
          >
            <Select.Select
              :model-value="dateFormat"
              @update:model-value="setDateFormat"
            >
              <Select.SelectTrigger class="w-64">
                <Select.SelectValue />
              </Select.SelectTrigger>
              <Select.SelectContent>
                <Select.SelectItem
                  v-for="(option, index) in DATE_FORMATS"
                  :key="option"
                  :value="option"
                >
                  {{
                    i18n.t(`preferences:appearance.dateFormat.options.${index}`)
                  }}
                </Select.SelectItem>
              </Select.SelectContent>
            </Select.Select>
            <template #description>
              {{
                i18n.t("preferences:appearance.dateFormat.preview", {
                  date: formatDate(datePreview),
                  interpolation: { escapeValue: false },
                })
              }}
            </template>
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

          <UiMenuFormItem
            :label="i18n.t('preferences:appearance.theme.themesDir')"
          >
            <template #description>
              {{ i18n.t("preferences:appearance.theme.dirDescription") }}
            </template>
            <template #actions>
              <div class="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  @click="openThemesDir"
                >
                  {{ i18n.t("preferences:appearance.theme.openDir") }}
                </Button>
                <Button
                  :disabled="isCreatingThemeTemplate"
                  @click="createThemeTemplate"
                >
                  {{
                    isCreatingThemeTemplate
                      ? i18n.t("preferences:appearance.theme.creatingTemplate")
                      : i18n.t("preferences:appearance.theme.createTemplate")
                  }}
                </Button>
                <Button
                  v-if="isCustomThemeActive"
                  variant="outline"
                  :disabled="isSubmittingTheme"
                  @click="submitCurrentTheme"
                >
                  {{ i18n.t("preferences:appearance.theme.submitToCommunity") }}
                  <ExternalLink class="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </template>
          </UiMenuFormItem>
        </UiMenuFormSection>
      </Tabs.TabsContent>

      <Tabs.TabsContent value="community">
        <PreferencesThemesCommunityThemes v-if="activeTab === 'community'" />
      </Tabs.TabsContent>
    </Tabs.Tabs>
  </div>
</template>
