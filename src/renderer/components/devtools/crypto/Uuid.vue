<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'
import { v1, v4 } from 'uuid'

type UuidType = 'v1' | 'v4'

const uuids = ref('')
const amount = ref(1)
const type = ref<UuidType>('v4')

const uuidTypeOptions = [
  {
    label: 'v1',
    value: 'v1',
  },
  {
    label: 'v4',
    value: 'v4',
  },
]

const title = computed(() => i18n.t('devtools:crypto.uuid.label'))
const description = computed(() => i18n.t('devtools:crypto.uuid.description'))

const { copy } = useClipboard()

function generateUuid(type: UuidType) {
  if (type === 'v1') {
    uuids.value = Array.from({ length: amount.value }, () => v1()).join('\n')
  }
  else {
    uuids.value = Array.from({ length: amount.value }, () => v4()).join('\n')
  }
}

watch(amount, (v) => {
  if (v > 100) {
    nextTick(() => {
      amount.value = 100
    })
  }
})
</script>

<template>
  <div class="space-y-6">
    <UiHeading
      :title="title"
      :description="description"
    />
    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.amount')"
        :level="3"
      />
      <UiInput
        v-model="amount"
        type="number"
        description="Max 100"
        class="w-64"
      />
      <UiHeading
        :title="i18n.t('devtools:form.version')"
        :level="3"
      />
      <Select.Select v-model="type">
        <Select.SelectTrigger class="w-64">
          <Select.SelectValue placeholder="Select a language" />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="i in uuidTypeOptions"
            :key="i.value"
            :value="i.value"
          >
            {{ i.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.output')"
        :level="3"
      />
      <UiInput
        :model-value="uuids"
        type="textarea"
        readonly
      />
      <div class="flex items-center gap-2">
        <UiButton
          size="md"
          @click="generateUuid(type)"
        >
          {{ i18n.t("button.generate") }}
        </UiButton>
        <UiButton
          size="md"
          @click="copy(uuids)"
        >
          {{ i18n.t("button.copy") }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
