<template>
  <div class="case-converter-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputString')">
        <AppInput
          v-model="inputValue"
          type="textarea"
        />
        <template #actions>
          <AppButton @click="onClick('camelCase')">
            camelCase
          </AppButton>
          <AppButton @click="onClick('kebabCase')">
            kebab-case
          </AppButton>
          <AppButton @click="onClick('snakeCase')">
            snake_case
          </AppButton>
          <AppButton @click="onClick('pascalCase')">
            PascalCase
          </AppButton>
          <AppButton @click="onClick('lowerCase')">
            lower case
          </AppButton>
          <AppButton @click="onClick('startCase')">
            Start Case
          </AppButton>
          <AppButton @click="onClick('upperCase')">
            UPPER CASE
          </AppButton>
        </template>
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.outputString')">
        <AppInput
          v-model="outputValue"
          type="textarea"
          readonly
        />
        <template #actions>
          <AppButton @click="onClear">
            {{ i18n.t('common:button.clear') }}
          </AppButton>
          <AppButton @click="onCopy">
            {{ i18n.t('common:button.copy') }}
          </AppButton>
        </template>
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { i18n } from '@/electron'
import { track } from '@/services/analytics'
import { ref } from 'vue'
import { camelCase, kebabCase, startCase, snakeCase } from 'lodash'
import { useClipboard } from '@vueuse/core'

const inputValue = ref('')
const outputValue = ref('')

type CaseType =
  | 'camelCase'
  | 'kebabCase'
  | 'lowerCase'
  | 'startCase'
  | 'upperCase'
  | 'snakeCase'
  | 'pascalCase'

function pascalCase (str: string) {
  return camelCase(str).replace(/^[a-z]/, s => s.toUpperCase())
}

function onClick (type: CaseType) {
  if (type === 'camelCase') {
    outputValue.value = camelCase(inputValue.value)
  } else if (type === 'kebabCase') {
    outputValue.value = kebabCase(inputValue.value)
  } else if (type === 'lowerCase') {
    outputValue.value = inputValue.value.toLowerCase()
  } else if (type === 'startCase') {
    outputValue.value = startCase(inputValue.value)
  } else if (type === 'upperCase') {
    outputValue.value = inputValue.value.toUpperCase()
  } else if (type === 'snakeCase') {
    outputValue.value = snakeCase(inputValue.value)
  } else if (type === 'pascalCase') {
    outputValue.value = pascalCase(inputValue.value)
  }
}

function onClear () {
  inputValue.value = ''
  outputValue.value = ''
}

function onCopy () {
  const { copy } = useClipboard()
  copy(outputValue.value)
}

track('devtools/text-tools/case-converter')
</script>

<style lang="scss" scoped></style>
