<template>
  <div class="hmac-tools">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputString')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
          type="textarea"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.algorithm')">
        <AppSelect
          v-model="algo"
          :options="options"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.secretKey')">
        <AppInput
          v-model="secretValue"
          style="width: 100%"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.result')">
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
import { ref, computed } from 'vue'
import sha1 from 'crypto-js/hmac-sha1'
import sha224 from 'crypto-js/hmac-sha224'
import sha256 from 'crypto-js/hmac-sha256'
import sha384 from 'crypto-js/hmac-sha384'
import sha512 from 'crypto-js/hmac-sha512'
import sha3 from 'crypto-js/hmac-sha3'
import md5 from 'crypto-js/hmac-md5'
import ripemd160 from 'crypto-js/hmac-ripemd160'
import type { Algo } from './types'
import options from './algo-options.json'
import { useCopy } from '../composables'

const inputValue = ref('')
const secretValue = ref('')
const algo = ref<Algo>('md5')

const outputValue = computed(() => {
  let result = ''
  if (inputValue.value === '') {
    return result
  }

  if (algo.value === 'sha256') {
    result = sha256(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'sha512') {
    result = sha512(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'md5') {
    result = md5(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'sha1') {
    result = sha1(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'sha224') {
    result = sha224(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'sha384') {
    result = sha384(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'sha3') {
    result = sha3(inputValue.value, secretValue.value).toString()
  }

  if (algo.value === 'ripemd160') {
    result = ripemd160(inputValue.value, secretValue.value).toString()
  }

  return result
})

function onClear () {
  inputValue.value = ''
}

track('devtools/hmac-generator')
</script>

<style lang="scss" scoped></style>
