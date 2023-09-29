<template>
  <div class="slug-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputString')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
          type="textarea"
        />
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
import { ref, computed } from 'vue'
import slugify from 'slugify'
import { useCopy } from '../composables'

const inputValue = ref('')
const outputValue = computed(() => {
  const lines = inputValue.value.split('\n')
  return lines.map(line => slugify(line)).join('\n')
})

function onClear () {
  inputValue.value = ''
}

track('devtools/slug-generator')
</script>

<style lang="scss" scoped></style>
