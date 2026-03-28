<script setup lang="ts">
import type { MathSettings } from '~/main/store/types'
import * as Select from '@/components/ui/shadcn/select'
import {
  formatMathDate,
  formatMathNumber,
} from '@/composables/math-notebook/math-engine/format'
import { i18n, store } from '@/electron'

const settings = reactive(store.preferences.get('math') as MathSettings)

watch(
  settings,
  () => {
    store.preferences.set('math', JSON.parse(JSON.stringify(settings)))
  },
  { deep: true },
)

const localeOptions = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Fran\u00E7ais', value: 'fr-FR' },
  { label: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', value: 'ru-RU' },
  { label: 'Espa\u00F1ol', value: 'es-ES' },
  { label: 'Portugu\u00EAs (BR)', value: 'pt-BR' },
  { label: '\u65E5\u672C\u8A9E', value: 'ja-JP' },
  { label: '\u4E2D\u6587', value: 'zh-CN' },
  { label: '\uD55C\uAD6D\uC5B4', value: 'ko-KR' },
  { label: 'Italiano', value: 'it-IT' },
  { label: 'Polski', value: 'pl-PL' },
  {
    label: '\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430',
    value: 'uk-UA',
  },
  { label: 'T\u00FCrk\u00E7e', value: 'tr-TR' },
  { label: 'Nederlands', value: 'nl-NL' },
]

const decimalPlacesOptions = Array.from({ length: 15 }, (_, i) => ({
  label: String(i),
  value: String(i),
}))

const localePreview = computed(() => {
  const num = formatMathNumber(
    1234.5678,
    settings.locale,
    settings.decimalPlaces,
  )
  const date = formatMathDate(new Date(), settings.locale)
  return `${num} \u00B7 ${date}`
})

const decimalPlacesPreview = computed(() => {
  return `1/3 = ${formatMathNumber(1 / 3, settings.locale, settings.decimalPlaces)}`
})
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:math.label')">
      <UiMenuFormItem :label="i18n.t('preferences:math.locale.label')">
        <Select.Select v-model="settings.locale">
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="option in localeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:math.locale.description") }}
          {{ localePreview }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:math.decimalPlaces.label')">
        <Select.Select
          :model-value="String(settings.decimalPlaces)"
          @update:model-value="settings.decimalPlaces = Number($event)"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="option in decimalPlacesOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("preferences:math.decimalPlaces.description") }}
          {{ decimalPlacesPreview }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
