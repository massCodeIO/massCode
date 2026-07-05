<script setup lang="ts">
import type { TasksSettings } from '~/main/store/types'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useNotes, useNotesEditor } from '@/composables'
import { i18n, store } from '@/electron'

const { settings } = useNotesEditor()
const { cleanupCompletedTasks } = useNotes()

watch(
  settings,
  () => {
    if (settings.fontSize < 1)
      settings.fontSize = 1
    if (settings.indentSize < 1)
      settings.indentSize = 1
  },
  { deep: true },
)

const tasksSettings = reactive(store.preferences.get('tasks') as TasksSettings)

if (!tasksSettings.autoCleanupCompleted) {
  tasksSettings.autoCleanupCompleted = 'never'
}

watch(
  tasksSettings,
  () => {
    store.preferences.set('tasks', JSON.parse(JSON.stringify(tasksSettings)))
  },
  { deep: true },
)

const autoCleanupOptions = [
  { label: i18n.t('preferences:tasks.autoCleanup.never'), value: 'never' },
  { label: i18n.t('preferences:tasks.autoCleanup.1d'), value: '1d' },
  { label: i18n.t('preferences:tasks.autoCleanup.7d'), value: '7d' },
  { label: i18n.t('preferences:tasks.autoCleanup.30d'), value: '30d' },
]

const isCleaningUp = ref(false)

async function onCleanupNow() {
  isCleaningUp.value = true
  try {
    await cleanupCompletedTasks()
  }
  finally {
    isCleaningUp.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:notesEditor.label')">
      <UiMenuFormItem :label="i18n.t('preferences:notesEditor.fontSize.label')">
        <UiInput
          v-model="settings.fontSize"
          type="number"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:notesEditor.fontSize.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:notesEditor.fontFamily.label')"
      >
        <UiInput
          v-model="settings.fontFamily"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:notesEditor.fontFamily.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:notesEditor.codeFontFamily.label')"
      >
        <UiInput
          v-model="settings.codeFontFamily"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:notesEditor.codeFontFamily.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:notesEditor.lineHeight.label')"
      >
        <Select.Select v-model="settings.lineHeight">
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem :value="1.4">
              {{ i18n.t("preferences:notesEditor.lineHeight.compact") }}
            </Select.SelectItem>
            <Select.SelectItem :value="1.54">
              {{ i18n.t("preferences:notesEditor.lineHeight.default") }}
            </Select.SelectItem>
            <Select.SelectItem :value="1.7">
              {{ i18n.t("preferences:notesEditor.lineHeight.relaxed") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:notesEditor.lineHeight.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:notesEditor.indentSize.label')"
      >
        <UiInput
          v-model="settings.indentSize"
          type="number"
          size="sm"
        />
        <template #description>
          {{ i18n.t("preferences:notesEditor.indentSize.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:notesEditor.limitWidth.label')"
      >
        <Switch
          :checked="settings.limitWidth"
          @update:checked="settings.limitWidth = $event"
        />
        <template #description>
          {{ i18n.t("preferences:notesEditor.limitWidth.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:notesEditor.lineNumbers.label')"
      >
        <Switch
          :checked="settings.lineNumbers"
          @update:checked="settings.lineNumbers = $event"
        />
        <template #description>
          {{ i18n.t("preferences:notesEditor.lineNumbers.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
    <UiMenuFormSection :label="i18n.t('preferences:tasks.label')">
      <UiMenuFormItem :label="i18n.t('preferences:tasks.autoCleanup.label')">
        <Select.Select v-model="tasksSettings.autoCleanupCompleted">
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="option in autoCleanupOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:tasks.autoCleanup.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:tasks.cleanupNow.label')">
        <Button
          variant="outline"
          :disabled="isCleaningUp"
          @click="onCleanupNow"
        >
          {{ i18n.t("preferences:tasks.cleanupNow.button") }}
        </Button>
        <template #description>
          {{ i18n.t("preferences:tasks.cleanupNow.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
