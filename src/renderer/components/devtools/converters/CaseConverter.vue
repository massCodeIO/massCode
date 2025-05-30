<script setup lang="ts">
import { i18n } from '@/electron'
import {
  camelCase,
  capitalCase,
  constantCase,
  dotCase,
  kebabCase,
  pascalCase,
  pathCase,
  snakeCase,
} from 'change-case'
import { Copy } from 'lucide-vue-next'

const text = ref('')

const title = computed(() => i18n.t('devtools:converters.caseConverter.label'))
const description = computed(() =>
  i18n.t('devtools:converters.caseConverter.description'),
)

const caseType = {
  uppercase: i18n.t('devtools:converters.caseConverter.caseType.uppercase'),
  lowercase: i18n.t('devtools:converters.caseConverter.caseType.lowercase'),
  camelcase: i18n.t('devtools:converters.caseConverter.caseType.camelcase'),
  snakecase: i18n.t('devtools:converters.caseConverter.caseType.snakecase'),
  kebabcase: i18n.t('devtools:converters.caseConverter.caseType.kebabcase'),
  pascalcase: i18n.t('devtools:converters.caseConverter.caseType.pascalcase'),
  constantcase: i18n.t(
    'devtools:converters.caseConverter.caseType.constantcase',
  ),
  capitalize: i18n.t('devtools:converters.caseConverter.caseType.capitalize'),
  dotcase: i18n.t('devtools:converters.caseConverter.caseType.dotcase'),
  pathcase: i18n.t('devtools:converters.caseConverter.caseType.pathcase'),
} as const

function convert(input: string, type: keyof typeof caseType): string {
  if (!input)
    return ''

  switch (type) {
    case 'uppercase':
      return input.toUpperCase()
    case 'lowercase':
      return input.toLowerCase()
    case 'camelcase':
      return camelCase(input)
    case 'capitalize':
      return capitalCase(input)
    case 'constantcase':
      return constantCase(input)
    case 'snakecase':
      return snakeCase(input)
    case 'kebabcase':
      return kebabCase(input)
    case 'pascalcase':
      return pascalCase(input)
    case 'dotcase':
      return dotCase(input)
    case 'pathcase':
      return pathCase(input)
    default:
      return input
  }
}

function copyCase(type: keyof typeof caseType) {
  navigator.clipboard.writeText(convert(text.value, type))
}

const output = computed(() => {
  return Object.entries(caseType).map(([key, value]) => ({
    label: value,
    value: convert(text.value, key as keyof typeof caseType),
  }))
})
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.input')"
        :level="3"
      />
      <UiInput
        v-model="text"
        :placeholder="i18n.t('devtools:form.placeholder.text')"
        clearable
      />
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.output')"
        :level="3"
      />
      <div
        class="grid grid-cols-[max-content_1fr_max-content] items-center gap-4"
      >
        <template
          v-for="[type, label] in Object.entries(caseType)"
          :key="type"
        >
          <div class="text-text-secondary text-sm font-medium">
            {{ label }}
          </div>
          <UiInput
            :model-value="output.find((item) => item.label === label)?.value"
            readonly
          />
          <UiButton
            variant="icon"
            size="md"
            @click="copyCase(type as keyof typeof caseType)"
          >
            <Copy class="h-3 w-3" />
          </UiButton>
        </template>
      </div>
    </div>
  </div>
</template>
