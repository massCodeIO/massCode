<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { normalizeTerminalText } from '@/utils/normalizeTerminalText'

const input = ref('')
const output = computed(() => normalizeTerminalText(input.value))

const copy = useCopyToClipboard()

const title = computed(() =>
  i18n.t('devtools:converters.lineBreakNormalizer.label'),
)
const description = computed(() =>
  i18n.t('devtools:converters.lineBreakNormalizer.description'),
)
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
        type="textarea"
      />
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.output')"
        :level="3"
      />
      <UiInput
        :model-value="output"
        type="textarea"
        readonly
      />
      <Button
        variant="outline"
        @click="copy(output)"
      >
        {{ i18n.t("button.copy") }}
      </Button>
    </div>
  </div>
</template>
