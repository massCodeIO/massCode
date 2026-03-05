<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useTheme } from '@/composables'
import { i18n, ipc } from '@/electron'

const { currentThemeId, customThemes, loadCustomThemes, setTheme } = useTheme()

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

async function onThemeChange(id: string) {
  await setTheme(id)
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
  <div class="space-y-5">
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

    <UiMenuFormItem :label="i18n.t('preferences:appearance.theme.themesDir')">
      <template #description>
        {{ i18n.t("preferences:appearance.theme.dirDescription") }}
      </template>
      <template #actions>
        <div class="flex gap-2">
          <UiButton
            size="md"
            @click="openThemesDir"
          >
            {{ i18n.t("preferences:appearance.theme.openDir") }}
          </UiButton>
          <UiButton
            size="md"
            variant="primary"
            @click="createThemeTemplate"
          >
            {{ i18n.t("preferences:appearance.theme.createTemplate") }}
          </UiButton>
        </div>
      </template>
    </UiMenuFormItem>
  </div>
</template>
