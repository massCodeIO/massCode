<template>
  <div class="case-converter-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputString')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
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
          style="width: 100%"
          type="textarea"
          readonly
        />
        <template #actions>
          <AppButton @click="onClear">
            {{ i18n.t('common:button.clear') }}
          </AppButton>
          <AppButton @click="useCopy(outputValue)">
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
import { useCopy } from '../composables'

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
  const lines = inputValue.value.split('\n')

  if (type === 'camelCase') {
    outputValue.value = lines.map(line => camelCase(line)).join('\n')
  } else if (type === 'kebabCase') {
    outputValue.value = lines.map(line => kebabCase(line)).join('\n')
  } else if (type === 'lowerCase') {
    outputValue.value = inputValue.value.toLowerCase()
  } else if (type === 'startCase') {
    outputValue.value = lines.map(line => startCase(line)).join('\n')
  } else if (type === 'upperCase') {
    outputValue.value = inputValue.value.toUpperCase()
  } else if (type === 'snakeCase') {
    outputValue.value = lines.map(line => snakeCase(line)).join('\n')
  } else if (type === 'pascalCase') {
    outputValue.value = lines.map(line => pascalCase(line)).join('\n')
  }
}

function onClear () {
  inputValue.value = ''
  outputValue.value = ''
}

track('devtools/case-converter')
</script>

<style lang="scss" scoped></style>
