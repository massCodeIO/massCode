<template>
  <div class="slug-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputString')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
          type="textarea"
        />
        <template #actions>
          <AppButton @click="onSort('sort')">
            {{ i18n.t('common:button.sort') }}
          </AppButton>
          <AppButton @click="onSort('revers')">
            {{ i18n.t('common:button.revers') }}
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
import { useCopy } from '../composables'

const inputValue = ref('')
const outputValue = ref('')

function onClear () {
  inputValue.value = ''
  outputValue.value = ''
}

function onSort (type: string) {
  const lines = inputValue.value.split('\n')

  if (type === 'sort') {
    lines.sort()
  } else if (type === 'revers') {
    lines.reverse()
  }

  const nonEmptyLines = lines.filter(line => line.trim() !== '')

  outputValue.value = nonEmptyLines.join('\n')
}

track('devtools/sort')
</script>

<style lang="scss" scoped></style>
