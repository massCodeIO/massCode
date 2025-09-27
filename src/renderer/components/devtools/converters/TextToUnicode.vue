<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'

const text = ref('')
const isUnicodeToText = ref(false)

const title = computed(() => i18n.t('devtools:converters.textToUnicode.label'))
const description = computed(() =>
  i18n.t('devtools:converters.textToUnicode.description'),
)

function convertTextToUnicode(input: string): string {
  if (!input) {
    return ''
  }

  return input
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      const hex = code.toString(16).toUpperCase().padStart(4, '0')
      return `\\u${hex}`
    })
    .join('')
}

function convertUnicodeToText(input: string): string {
  if (!input) {
    return ''
  }

  try {
    const normalized = input.replace(/\\u/g, '\\u')
    return JSON.parse(`"${normalized}"`)
  }
  catch {
    try {
      return input.replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => {
        return String.fromCharCode(Number.parseInt(hex, 16))
      })
    }
    catch {
      return input
    }
  }
}

function convert() {
  if (isUnicodeToText.value) {
    return convertUnicodeToText(text.value)
  }
  else {
    return convertTextToUnicode(text.value)
  }
}

const output = computed(() => convert())

const { copy } = useClipboard()
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="flex items-center gap-2">
      {{ i18n.t("devtools:converters.textToUnicode.modes.textToUnicode") }}
      <Switch
        :checked="isUnicodeToText"
        @update:checked="isUnicodeToText = $event"
      />
      {{ i18n.t("devtools:converters.textToUnicode.modes.unicodeToText") }}
    </div>
    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.input')"
        :level="3"
      />
      <UiInput
        v-model="text"
        :placeholder="i18n.t('devtools:form.placeholder.text')"
        clearable
        type="textarea"
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
