<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useTheme } from '@/composables'
import { i18n } from '@/electron'

const { theme } = useTheme()
</script>

<template>
  <div>
    <UiMenuFormItem :label="i18n.t('preferences:appearance.theme.label')">
      <Select.Select v-model="theme">
        <Select.SelectTrigger class="w-64">
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem value="light">
            {{ i18n.t("preferences:appearance.theme.light") }}
          </Select.SelectItem>
          <Select.SelectItem value="dark">
            {{ i18n.t("preferences:appearance.theme.dark") }}
          </Select.SelectItem>
          <Select.SelectItem value="auto">
            {{ i18n.t("preferences:appearance.theme.system") }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </UiMenuFormItem>
  </div>
</template>
