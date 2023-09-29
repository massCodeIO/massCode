<template>
  <div class="url-encode-decode-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.type')">
        <AppSelect
          v-model="type"
          :options="options"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.inputUrl')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
          type="textarea"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.outputUrl')">
        <AppInput
          v-model="outputValue"
          style="width: 100%"
          type="textarea"
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
import { ref, computed } from 'vue'
import { useClipboard } from '@vueuse/core'

const inputValue = ref('')
const type = ref<'encode | decode'>('encode')

const options = [
  { label: 'Encode', value: 'encode' },
  { label: 'Decode', value: 'decode' }
]

const outputValue = computed(() => {
  let result = ''
  if (inputValue.value === '') {
    return result
  }

  if (type.value === 'encode') {
    result = encodeURIComponent(inputValue.value)
  }

  if (type.value === 'decode') {
    result = decodeURIComponent(inputValue.value)
  }

  return result
})

function onClear () {
  inputValue.value = ''
}

function onCopy () {
  const { copy } = useClipboard()
  copy(outputValue.value)
}
</script>

<style lang="scss" scoped></style>
