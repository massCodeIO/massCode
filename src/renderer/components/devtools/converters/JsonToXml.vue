<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'

const text = ref('')
const error = ref('')

const isXmlToJson = ref(false)

const { copy } = useClipboard()

const title = computed(() => i18n.t('devtools:converters.jsonToXml.label'))
const description = computed(() =>
  i18n.t('devtools:converters.jsonToXml.description'),
)

function objectToXml(obj: any, rootName = 'root', indent = 0): string {
  const spaces = '  '.repeat(indent)

  if (obj === null || obj === undefined) {
    return `${spaces}<${rootName}></${rootName}>`
  }

  if (
    typeof obj === 'string'
    || typeof obj === 'number'
    || typeof obj === 'boolean'
  ) {
    return `${spaces}<${rootName}>${obj}</${rootName}>`
  }

  if (Array.isArray(obj)) {
    const items = obj
      .map(item => objectToXml(item, 'item', indent + 1))
      .join('\n')
    return `${spaces}<${rootName}>\n${items}\n${spaces}</${rootName}>`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
      .map(([key, value]) => objectToXml(value, key, indent + 1))
      .join('\n')
    return `${spaces}<${rootName}>\n${entries}\n${spaces}</${rootName}>`
  }

  return `${spaces}<${rootName}>${obj}</${rootName}>`
}

function convertJsonToXml(jsonString: string): string {
  if (!text.value) {
    return ''
  }

  try {
    error.value = ''
    const jsonObject = JSON.parse(jsonString)
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n'
    const xmlBody = objectToXml(jsonObject, 'root', 0)
    return xmlHeader + xmlBody
  }
  catch {
    error.value = 'Invalid JSON format'
    return ''
  }
}

/**
 * Простой парсер XML в JSON объект
 * Использует DOMParser для парсинга XML
 */
function xmlElementToObject(element: Element): any {
  const result: any = {}

  // Обработка атрибутов
  if (element.attributes.length > 0) {
    result['@attributes'] = {}
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i]
      result['@attributes'][attr.name] = attr.value
    }
  }

  // Обработка дочерних элементов
  const children = Array.from(element.children)

  if (children.length === 0) {
    // Если нет дочерних элементов, возвращаем текстовое содержимое
    const textContent = element.textContent?.trim()
    if (textContent) {
      if (result['@attributes']) {
        result['#text'] = textContent
        return result
      }
      return textContent
    }
    return result['@attributes'] ? result : null
  }

  // Группировка дочерних элементов по имени тега
  const childGroups: { [key: string]: Element[] } = {}
  children.forEach((child) => {
    const tagName = child.tagName
    if (!childGroups[tagName]) {
      childGroups[tagName] = []
    }
    childGroups[tagName].push(child)
  })

  // Конвертация групп в объект
  Object.entries(childGroups).forEach(([tagName, elements]) => {
    if (elements.length === 1) {
      result[tagName] = xmlElementToObject(elements[0])
    }
    else {
      result[tagName] = elements.map(el => xmlElementToObject(el))
    }
  })

  return result
}

function convertXmlToJson(xmlString: string): string {
  if (!text.value) {
    return ''
  }

  try {
    error.value = ''
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml')

    // Проверка на ошибки парсинга
    const parseError = xmlDoc.querySelector('parsererror')
    if (parseError) {
      throw new Error('XML parsing error')
    }

    const rootElement = xmlDoc.documentElement
    const jsonObject = xmlElementToObject(rootElement)

    return JSON.stringify({ [rootElement.tagName]: jsonObject }, null, 4)
  }
  catch {
    error.value = 'Invalid XML format'
    return ''
  }
}

function convert() {
  if (isXmlToJson.value) {
    return convertXmlToJson(text.value)
  }

  return convertJsonToXml(text.value)
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
      {{ i18n.t("devtools:converters.jsonToXml.modes.jsonToXml") }}
      <Switch
        :checked="isXmlToJson"
        @update:checked="isXmlToJson = $event"
      />
      {{ i18n.t("devtools:converters.jsonToXml.modes.xmlToJson") }}
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
