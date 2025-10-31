<script setup lang="ts">
import { i18n, ipc, store } from '@/electron'

const apiPort = ref(store.preferences.get('apiPort'))

watch(apiPort, (value) => {
  const port = Number(value)
  if (port >= 1024 && port <= 65535) {
    store.preferences.set('apiPort', port)
  }
})
</script>

<template>
  <div class="space-y-5">
    <UiMenuFormItem :label="i18n.t('preferences:api.port.label')">
      <UiInput
        v-model="apiPort"
        type="number"
        min="1024"
        max="65535"
        size="sm"
        class="w-32"
      />
      <template #description>
        {{ i18n.t("preferences:api.port.description") }}
      </template>
      <template #actions>
        <UiButton
          size="md"
          @click="ipc.invoke('system:reload', null)"
        >
          {{ i18n.t("action.reload.app") }}
        </UiButton>
      </template>
    </UiMenuFormItem>
  </div>
</template>
