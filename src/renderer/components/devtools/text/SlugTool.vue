<template>
  <div class="slug-tool">
    <AppForm>
      <AppFormItem :label="i18n.t('devtools:form.inputString')">
        <AppInput
          v-model="inputValue"
          style="width: 100%"
        />
      </AppFormItem>
      <AppFormItem :label="i18n.t('devtools:form.outputString')">
        <AppInput
          v-model="outputValue"
          style="width: 100%"
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
import { ref, computed } from 'vue'
import slugify from 'slugify'
import { useClipboard } from '@vueuse/core'

const inputValue = ref('')
const outputValue = computed(() => slugify(inputValue.value))

function onClear () {
  inputValue.value = ''
}

function onCopy () {
  const { copy } = useClipboard()
  copy(outputValue.value)
}

track('devtools/text-tools/slug-generator')
</script>

<style lang="scss" scoped></style>
