<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'
import * as toml from 'toml'

const text = ref('')
const error = ref('')

const isTomlToJson = ref(false)

const { copy } = useClipboard()

const title = computed(() => i18n.t('devtools:converters.jsonToToml.label'))
const description = computed(() =>
  i18n.t('devtools:converters.jsonToToml.description'),
)

function convertJsonToToml(jsonString: string): string {
  if (!text.value) {
    return ''
  }

  try {
    error.value = ''
    const jsonObject = JSON.parse(jsonString)
    return tomlStringify(jsonObject)
  }
  catch {
    error.value = 'Invalid JSON format'
    return ''
  }
}

function convertTomlToJson(tomlString: string): string {
  if (!text.value) {
    return ''
  }

  try {
    error.value = ''
    const tomlObject = toml.parse(tomlString)
    return JSON.stringify(tomlObject, null, 4)
  }
  catch {
    error.value = 'Invalid TOML format'
    return ''
  }
}

/**
 * Простая функция для конвертации объекта в TOML строку
 * Поскольку библиотека toml не имеет stringify, реализуем базовую версию
 */
function tomlStringify(obj: any, prefix = ''): string {
  let result = ''

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      continue
    }
    else if (typeof value === 'object' && !Array.isArray(value)) {
      // Объект - создаем секцию
      result += `\n[${fullKey}]\n`
      result += tomlStringify(value, fullKey)
    }
    else if (Array.isArray(value)) {
      // Массив
      result += `${key} = ${JSON.stringify(value)}\n`
    }
    else if (typeof value === 'string') {
      // Строка
      result += `${key} = "${value}"\n`
    }
    else {
      // Число, булево значение
      result += `${key} = ${value}\n`
    }
  }

  return result
}

function convert() {
  if (isTomlToJson.value) {
    return convertTomlToJson(text.value)
  }

  return convertJsonToToml(text.value)
}

const output = computed(() => convert())
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="flex items-center gap-2">
      {{ i18n.t("devtools:converters.jsonToToml.modes.jsonToToml") }}
      <Switch
        :checked="isTomlToJson"
        @update:checked="isTomlToJson = $event"
      />
      {{ i18n.t("devtools:converters.jsonToToml.modes.tomlToJson") }}
    </div>
    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.input')"
        :level="3"
      />
      <UiInput
        v-model="text"
        :placeholder="i18n.t('devtools:form.placeholder.text')"
        :error="error"
        type="textarea"
        clearable
      />
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.output')"
        :level="3"
      />
      <UiInput
        :model-value="output"
        type="textarea"
        readonly
      />
      <UiButton
        size="md"
        @click="copy(output)"
      >
        {{ i18n.t("button.copy") }}
      </UiButton>
    </div>
  </div>
</template>
