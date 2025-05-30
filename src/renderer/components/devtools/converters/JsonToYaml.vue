<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'
import yaml from 'js-yaml'

const text = ref('')
const error = ref('')

const isYamlToJson = ref(false)

const { copy } = useClipboard()

const title = computed(() => i18n.t('devtools:converters.jsonToYaml.label'))
const description = computed(() =>
  i18n.t('devtools:converters.jsonToYaml.description'),
)

function convertJsonToYaml(jsonString: string): string {
  if (!text.value) {
    return ''
  }

  try {
    error.value = ''
    const jsonObject = JSON.parse(jsonString)
    return yaml.dump(jsonObject, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    })
  }
  catch {
    error.value = 'Invalid JSON format'
    return ''
  }
}

function convertYamlToJson(yamlString: string): string {
  if (!text.value) {
    return ''
  }

  try {
    error.value = ''
    const yamlObject = yaml.load(yamlString)
    return JSON.stringify(yamlObject, null, 4)
  }
  catch {
    error.value = 'Invalid YAML format'
    return ''
  }
}

function convert() {
  if (isYamlToJson.value) {
    return convertYamlToJson(text.value)
  }

  return convertJsonToYaml(text.value)
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
      {{ i18n.t("devtools:converters.jsonToYaml.modes.jsonToYaml") }}
      <Switch
        :checked="isYamlToJson"
        @update:checked="isYamlToJson = $event"
      />
      {{ i18n.t("devtools:converters.jsonToYaml.modes.yamlToJson") }}
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
