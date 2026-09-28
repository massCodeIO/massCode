<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useHttpSettings } from '@/composables'
import { i18n } from '@/electron'
import { HTTP_HISTORY_LIMITS } from '~/shared/httpHistory'
import { HTTP_TRANSPORT_DEFAULTS } from '~/shared/httpTransport'

const { settings } = useHttpSettings()
const transport = computed({
  get: () => settings.transport ?? {},
  set: (value) => {
    settings.transport = value
  },
})
</script>

<template>
  <div class="space-y-4">
    <HttpTransportSettings
      v-model="transport"
      :defaults="HTTP_TRANSPORT_DEFAULTS"
      global
    >
      <UiMenuFormItem
        :label="i18n.t('preferences:http.sslCertificateVerification.label')"
      >
        <Switch
          :checked="!settings.skipCertificateVerification"
          @update:checked="settings.skipCertificateVerification = !$event"
        />
        <template #description>
          {{
            i18n.t("preferences:http.sslCertificateVerification.description")
          }}
        </template>
      </UiMenuFormItem>
    </HttpTransportSettings>
    <UiMenuFormSection :label="i18n.t('preferences:http.interface')">
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
        <div class="space-y-2">
          <HttpPreviewFormatSelect v-model="settings.defaultPreviewFormat" />
          <HttpPreviewClientTabs v-model="settings.defaultPreviewFormat" />
        </div>
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
    <UiMenuFormSection :label="i18n.t('preferences:http.history.section')">
      <UiMenuFormItem :label="i18n.t('preferences:http.history.label')">
        <Select.Select
          :model-value="String(settings.historyLimit ?? 20)"
          @update:model-value="settings.historyLimit = Number($event)"
        >
          <Select.SelectTrigger class="w-32">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="limit in HTTP_HISTORY_LIMITS"
              :key="limit"
              :value="String(limit)"
            >
              {{ limit === 0 ? i18n.t("preferences:http.history.off") : limit }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:http.history.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
