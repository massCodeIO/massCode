<template>
  <div class="hash-tools">
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
import sha1 from 'crypto-js/sha1'
import sha224 from 'crypto-js/sha224'
import sha256 from 'crypto-js/sha256'
import sha384 from 'crypto-js/sha384'
import sha512 from 'crypto-js/sha512'
import sha3 from 'crypto-js/sha3'
import md5 from 'crypto-js/md5'
import ripemd160 from 'crypto-js/ripemd160'
import type { Algo } from './types'
import options from './algo-options.json'
import { useCopy } from '../composables'

const inputValue = ref('')
const algo = ref<Algo>('md5')

const outputValue = computed(() => {
  let result = ''
  if (inputValue.value === '') {
    return result
  }

  if (algo.value === 'sha256') {
    result = sha256(inputValue.value).toString()
  }

  if (algo.value === 'sha512') {
    result = sha512(inputValue.value).toString()
  }

  if (algo.value === 'md5') {
    result = md5(inputValue.value).toString()
  }

  if (algo.value === 'sha1') {
    result = sha1(inputValue.value).toString()
  }

  if (algo.value === 'sha224') {
    result = sha224(inputValue.value).toString()
  }

  if (algo.value === 'sha384') {
    result = sha384(inputValue.value).toString()
  }

  if (algo.value === 'sha3') {
    result = sha3(inputValue.value).toString()
  }

  if (algo.value === 'ripemd160') {
    result = ripemd160(inputValue.value).toString()
  }

  return result
})

function onClear () {
  inputValue.value = ''
}

track('devtools/hash-generator')
</script>

<style lang="scss" scoped></style>
