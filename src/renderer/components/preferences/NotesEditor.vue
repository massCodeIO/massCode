<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useNotesEditor } from '@/composables'
import { i18n } from '@/electron'

const { settings } = useNotesEditor()

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
  </div>
</template>
