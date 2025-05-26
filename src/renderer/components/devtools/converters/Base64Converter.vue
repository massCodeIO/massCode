<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'

const text = ref('')
const isBase64ToText = ref(false)

const { copy } = useClipboard()

const title = computed(() => i18n.t('devtools:converters.base64.label'))
const description = computed(() =>
  i18n.t('devtools:converters.base64.description'),
)

function textToBase64(input: string): string {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    return btoa(String.fromCharCode(...data))
  }
  catch (error) {
    console.error('Error encoding to Base64:', error)
    return ''
  }
}

function base64ToText(input: string): string {
  try {
    const binaryString = atob(input)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  }
  catch (error) {
    console.error('Error decoding from Base64:', error)
    return ''
  }
}

const output = computed(() => {
  if (!text.value)
    return ''

  if (isBase64ToText.value) {
    return base64ToText(text.value)
  }
  else {
    return textToBase64(text.value)
  }
})
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="flex items-center gap-2">
      {{ i18n.t("devtools:converters.base64.modes.textToBase64") }}
      <Switch
        :checked="isBase64ToText"
        @update:checked="isBase64ToText = $event"
      />
      {{ i18n.t("devtools:converters.base64.modes.base64ToText") }}
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
