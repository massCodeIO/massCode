<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { i18n, ipc, store } from '@/electron'
import { language } from '~/main/i18n/language'

const languageOptions = Object.entries(language).map(([key, value]) => ({
  label: value,
  value: key,
}))

const selectedLanguage = ref(store.preferences.get('language'))

watch(selectedLanguage, (value) => {
  store.preferences.set('language', value)
})
</script>

<template>
  <div class="space-y-5">
    <UiMenuFormItem :label="i18n.t('preferences:language.label')">
      <template #description>
        {{ i18n.t("messages:description.language") }}
      </template>
      <Select.Select v-model="selectedLanguage">
        <Select.SelectTrigger class="w-64">
          <Select.SelectValue placeholder="Select a language" />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="i in languageOptions"
            :key="i.value"
            :value="i.value"
          >
            {{ i.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
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
