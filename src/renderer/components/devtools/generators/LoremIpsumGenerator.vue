<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { faker } from '@faker-js/faker'

type LoremType = 'words' | 'sentences' | 'paragraphs'

const MAX_COUNT = 1000

const loremType = ref<LoremType>('sentences')
const count = ref(10)
const output = ref('')

const copy = useCopyToClipboard()

const title = computed(() => i18n.t('devtools:generators.lorem.label'))
const description = computed(() =>
  i18n.t('devtools:generators.lorem.description'),
)

const loremTypes = [
  {
    label: i18n.t('devtools:generators.lorem.types.words'),
    value: 'words',
  },
  {
    label: i18n.t('devtools:generators.lorem.types.sentences'),
    value: 'sentences',
  },
  {
    label: i18n.t('devtools:generators.lorem.types.paragraphs'),
    value: 'paragraphs',
  },
]

function generate() {
  switch (loremType.value) {
    case 'words':
      output.value = faker.lorem.words(count.value)
      break
    case 'sentences':
      output.value = faker.lorem.sentences(count.value)
      break
    case 'paragraphs':
      output.value = faker.lorem.paragraphs(count.value, '\n\n')
      break
  }
}

watch(count, (v) => {
  if (v > MAX_COUNT) {
    nextTick(() => {
      count.value = MAX_COUNT
    })
  }
  if (v < 1) {
    nextTick(() => {
      count.value = 1
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
        :title="i18n.t('devtools:form.type')"
        :level="3"
      />
      <Select.Select v-model="loremType">
        <Select.SelectTrigger class="w-64">
          <Select.SelectValue
            :placeholder="i18n.t('devtools:generators.lorem.selectType')"
          />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="option in loremTypes"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </div>

    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:form.amount')"
        :level="3"
      />
      <UiInput
        v-model="count"
        type="number"
        :description="
          i18n.t('devtools:generators.lorem.maxCount', { count: MAX_COUNT })
        "
        class="w-64"
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
      <div class="flex items-center gap-2">
        <UiButton
          size="md"
          @click="generate"
        >
          {{ i18n.t("button.generate") }}
        </UiButton>
        <UiButton
          size="md"
          @click="copy(output)"
        >
          {{ i18n.t("button.copy") }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
