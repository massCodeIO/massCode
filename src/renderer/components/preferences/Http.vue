<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useHttpSettings } from '@/composables'
import { i18n } from '@/electron'

const { settings } = useHttpSettings()
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:http.label')">
      <UiMenuFormItem :label="i18n.t('preferences:http.wrapLines.label')">
        <Switch
          :checked="settings.wrapLines"
          @update:checked="settings.wrapLines = $event"
        />
        <template #description>
          {{ i18n.t("preferences:http.wrapLines.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem
        :label="i18n.t('preferences:http.defaultPreviewFormat.label')"
      >
        <Select.Select v-model="settings.defaultPreviewFormat">
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="http">
              {{ i18n.t("preferences:http.defaultPreviewFormat.http") }}
            </Select.SelectItem>
            <Select.SelectItem value="curl">
              {{ i18n.t("preferences:http.defaultPreviewFormat.curl") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:http.defaultPreviewFormat.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem
        :label="i18n.t('preferences:http.autoSwitchToResponse.label')"
      >
        <Switch
          :checked="settings.autoSwitchToResponse"
          @update:checked="settings.autoSwitchToResponse = $event"
        />
        <template #description>
          {{ i18n.t("preferences:http.autoSwitchToResponse.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
