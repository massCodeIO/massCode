<template>
  <div class="password-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.length')">
        <AppInput
          v-model="length"
          type="number"
        />
        <template #desc>
          Max: 2048
        </template>
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.options')">
        <AppCheckbox
          v-model="options.numbers"
          :label="i18n.t('devtools:form.numbers')"
          name="numbers"
        />
        <AppCheckbox
          v-model="options.symbols"
          :label="i18n.t('devtools:form.symbols')"
          name="symbols"
        />
        <AppCheckbox
          v-model="options.lowercase"
          :label="i18n.t('devtools:form.lowercase')"
          name="lowercase"
        />
        <AppCheckbox
          v-model="options.uppercase"
          :label="i18n.t('devtools:form.uppercase')"
          name="uppercase"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.result')">
        <AppInput
          v-model="outputValue"
          style="width: 100%"
          readonly
        />
        <template #actions>
          <AppButton @click="onGenerate">
            {{ i18n.t('common:button.generate') }}
          </AppButton>
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
import { ref, watch, nextTick, reactive } from 'vue'
import { useCopy } from '../composables'

const length = ref(10)
const outputValue = ref('')

const options = reactive({
  numbers: true,
  symbols: false,
  lowercase: true,
  uppercase: true
})

type PasswordOptions = {
  length: number
  includeSymbols: boolean
  includeNumbers: boolean
  useLowercaseOnly: boolean
  useUppercaseOnly: boolean
}

function generatePassword (options: PasswordOptions): string {
  const {
    length,
    includeNumbers,
    includeSymbols,
    useLowercaseOnly,
    useUppercaseOnly
  } = options

  const lowerCaseLetters = 'abcdefghijklmnopqrstuvwxyz'
  const upperCaseLetters = lowerCaseLetters.toUpperCase()
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_-+=<>?'

  let characters = useLowercaseOnly
    ? lowerCaseLetters
    : useUppercaseOnly
      ? upperCaseLetters
      : lowerCaseLetters + upperCaseLetters

  if (includeNumbers) {
    characters += numbers
  }

  if (includeSymbols) {
    characters += symbols
  }

  let password = ''

  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * characters.length)
    password += characters[index]
  }

  return password
}

function onGenerate () {
  outputValue.value = generatePassword({
    length: length.value,
    includeSymbols: options.symbols,
    includeNumbers: options.numbers,
    useLowercaseOnly: !options.uppercase && options.lowercase,
    useUppercaseOnly: !options.lowercase && options.uppercase
  })
}

function onClear () {
  outputValue.value = ''
}

watch(length, v => {
  if (v > 2048) {
    nextTick(() => {
      length.value = 2048
    })
  }
})

track('devtools/pass-generator')
</script>

<style lang="scss" scoped></style>
