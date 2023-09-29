<template>
  <div class="uuid-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.version')">
        <AppSelect
          v-model="version"
          :options="options"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.amount')">
        <AppInput
          v-model="amount"
          type="number"
        />
        <template #desc>
          Max: 1000
        </template>
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.result')">
        <AppInput
          v-model="outputValue"
          style="width: 100%"
          readonly
          type="textarea"
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
import { ref, watch, nextTick } from 'vue'
import { v1, v4 } from 'uuid'
import { useCopy } from '../composables'

const version = ref('1')
const amount = ref(1)
const outputValue = ref('')

const options = [
  { label: 'v1 (Timestamp-based)', value: '1' },
  { label: 'v4 (Random)', value: '4' }
]

function onGenerate () {
  const uuids = []
  for (let i = 0; i < amount.value; i++) {
    if (version.value === '1') {
      uuids.push(v1())
    } else {
      uuids.push(v4())
    }
  }
  outputValue.value = uuids.join('\n')
}

function onClear () {
  outputValue.value = ''
}

watch(amount, v => {
  if (v > 1000) {
    nextTick(() => {
      amount.value = 1000
    })
  }
})

track('devtools/uuid-generator')
</script>

<style lang="scss" scoped></style>
