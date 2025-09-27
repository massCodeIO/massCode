<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'

const text = ref('')
const isAsciiToText = ref(false)

const title = computed(() => i18n.t('devtools:converters.textToAscii.label'))
const description = computed(() =>
  i18n.t('devtools:converters.textToAscii.description'),
)

const { copy } = useClipboard()

function convertTextToAscii(input: string): string {
  if (!input) {
    return ''
  }

  return input
    .split('')
    .map((char) => {
      const asciiCode = char.charCodeAt(0)

      return asciiCode.toString(2).padStart(8, '0')
    })
    .join(' ')
}

function convertAsciiToText(input: string): string {
  if (!input) {
    return ''
  }

  try {
    const binaryNumbers = input.trim().split(/\s+/).filter(Boolean)

    return binaryNumbers
      .map((binary) => {
        if (!/^[01]+$/.test(binary)) {
          throw new Error(`Invalid binary: ${binary}`)
        }

        const asciiCode = Number.parseInt(binary, 2)

        if (asciiCode < 0 || asciiCode > 127) {
          throw new Error(`Invalid ASCII code: ${asciiCode}`)
        }

        return String.fromCharCode(asciiCode)
      })
      .join('')
  }
  catch (error) {
    console.warn('Error converting ASCII to text:', error)
    return input
  }
}

function convert() {
  if (isAsciiToText.value) {
    return convertAsciiToText(text.value)
  }
  else {
    return convertTextToAscii(text.value)
  }
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
      {{ i18n.t("devtools:converters.textToAscii.modes.textToAscii") }}
      <Switch
        :checked="isAsciiToText"
        @update:checked="isAsciiToText = $event"
      />
      {{ i18n.t("devtools:converters.textToAscii.modes.asciiToText") }}
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
