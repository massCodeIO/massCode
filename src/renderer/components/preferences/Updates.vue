<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n, store } from '@/electron'
import { version } from '../../../../package.json'

const isAutoUpdateEnabled = ref<boolean>(
  store.preferences.get('updates.autoUpdate') as boolean,
)

watch(isAutoUpdateEnabled, (value) => {
  store.preferences.set('updates.autoUpdate', value)
})
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:updates.label')">
      <UiMenuFormItem :label="i18n.t('preferences:updates.autoUpdate.label')">
        <Switch
          :checked="isAutoUpdateEnabled"
          @update:checked="isAutoUpdateEnabled = $event"
        />
        <template #description>
          {{ i18n.t("preferences:updates.autoUpdate.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem :label="i18n.t('preferences:updates.version.label')">
        <UiText
          as="div"
          variant="base"
        >
          v{{ version }}
        </UiText>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
