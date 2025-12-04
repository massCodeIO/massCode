<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'

const input = ref('')
const isUrlDecode = ref(false)

const title = computed(() => i18n.t('devtools:web.urlEncoder.label'))
const description = computed(() =>
  i18n.t('devtools:web.urlEncoder.description'),
)

const copy = useCopyToClipboard()

const output = computed(() => {
  if (isUrlDecode.value) {
    return decodeURIComponent(input.value)
  }
  return encodeURIComponent(input.value)
})
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="flex items-center gap-2">
      {{ i18n.t("devtools:web.urlEncoder.modes.urlEncode") }}
      <Switch
        :checked="isUrlDecode"
        @update:checked="isUrlDecode = $event"
      />
      {{ i18n.t("devtools:web.urlEncoder.modes.urlDecode") }}
    </div>
    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.input')"
        :level="3"
      />
      <UiInput
        v-model="input"
        :placeholder="i18n.t('devtools:form.placeholder.url')"
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
