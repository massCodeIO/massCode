<script setup lang="ts">
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'
import slugify from 'slugify'

const input = ref('')

const title = computed(() => i18n.t('devtools:web.slugify.label'))
const description = computed(() => i18n.t('devtools:web.slugify.description'))

const { copy } = useClipboard()

function slugifyText(text: string) {
  return slugify(text, {
    lower: true,
    strict: true,
  })
}

const output = computed(() => slugifyText(input.value))
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.input')"
        :level="3"
      />
      <UiInput
        v-model="input"
        :placeholder="i18n.t('devtools:form.placeholder.text')"
        clearable
      />
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.output')"
        :level="3"
      />
      <UiInput
        :model-value="output"
        readonly
      />
      <UiButton
        size="md"
        @click="copy(output)"
      >
        {{ i18n.t("button.copy") }}
      </UiButton>
    </div>
  </div>
</template>
