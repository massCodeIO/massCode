<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { faker } from '@faker-js/faker'
import { GripVertical, Plus, Trash2 } from 'lucide-vue-next'
import draggable from 'vuedraggable'

interface Field {
  id: string
  name: string
  type: string
}

const fields = ref<Field[]>([
  { id: crypto.randomUUID(), name: 'id', type: 'string.uuid' },
  { id: crypto.randomUUID(), name: 'firstName', type: 'person.firstName' },
  { id: crypto.randomUUID(), name: 'lastName', type: 'person.lastName' },
  { id: crypto.randomUUID(), name: 'email', type: 'internet.email' },
])

const count = ref(10)
const output = ref('')

const copy = useCopyToClipboard()

const title = computed(() => i18n.t('devtools:generators.json.label'))
const description = computed(() =>
  i18n.t('devtools:generators.json.description'),
)

const fakerTypes = [
  {
    category: i18n.t('devtools:generators.json.categories.general'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.rowNumber'),
        value: 'custom.rowNumber',
      },
      { label: 'UUID', value: 'string.uuid' },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.person'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.firstName'),
        value: 'person.firstName',
      },
      {
        label: i18n.t('devtools:generators.json.types.lastName'),
        value: 'person.lastName',
      },
      {
        label: i18n.t('devtools:generators.json.types.fullName'),
        value: 'person.fullName',
      },
      {
        label: i18n.t('devtools:generators.json.types.gender'),
        value: 'person.sex',
      },
      {
        label: i18n.t('devtools:generators.json.types.jobTitle'),
        value: 'person.jobTitle',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.internet'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.email'),
        value: 'internet.email',
      },
      {
        label: i18n.t('devtools:generators.json.types.username'),
        value: 'internet.username',
      },
      {
        label: i18n.t('devtools:generators.json.types.password'),
        value: 'internet.password',
      },
      {
        label: i18n.t('devtools:generators.json.types.url'),
        value: 'internet.url',
      },
      {
        label: i18n.t('devtools:generators.json.types.ipv4'),
        value: 'internet.ipv4',
      },
      {
        label: i18n.t('devtools:generators.json.types.ipv6'),
        value: 'internet.ipv6',
      },
      {
        label: i18n.t('devtools:generators.json.types.userAgent'),
        value: 'internet.userAgent',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.location'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.city'),
        value: 'location.city',
      },
      {
        label: i18n.t('devtools:generators.json.types.country'),
        value: 'location.country',
      },
      {
        label: i18n.t('devtools:generators.json.types.streetAddress'),
        value: 'location.streetAddress',
      },
      {
        label: i18n.t('devtools:generators.json.types.zipCode'),
        value: 'location.zipCode',
      },
      {
        label: i18n.t('devtools:generators.json.types.latitude'),
        value: 'location.latitude',
      },
      {
        label: i18n.t('devtools:generators.json.types.longitude'),
        value: 'location.longitude',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.finance'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.amount'),
        value: 'finance.amount',
      },
      {
        label: i18n.t('devtools:generators.json.types.currencyCode'),
        value: 'finance.currencyCode',
      },
      {
        label: i18n.t('devtools:generators.json.types.creditCardNumber'),
        value: 'finance.creditCardNumber',
      },
      { label: 'IBAN', value: 'finance.iban' },
      { label: 'BIC', value: 'finance.bic' },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.commerce'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.productName'),
        value: 'commerce.productName',
      },
      {
        label: i18n.t('devtools:generators.json.types.price'),
        value: 'commerce.price',
      },
      {
        label: i18n.t('devtools:generators.json.types.department'),
        value: 'commerce.department',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.company'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.companyName'),
        value: 'company.name',
      },
      {
        label: i18n.t('devtools:generators.json.types.catchPhrase'),
        value: 'company.catchPhrase',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.lorem'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.word'),
        value: 'lorem.word',
      },
      {
        label: i18n.t('devtools:generators.json.types.sentence'),
        value: 'lorem.sentence',
      },
      {
        label: i18n.t('devtools:generators.json.types.paragraph'),
        value: 'lorem.paragraph',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.date'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.past'),
        value: 'date.past',
      },
      {
        label: i18n.t('devtools:generators.json.types.future'),
        value: 'date.future',
      },
      {
        label: i18n.t('devtools:generators.json.types.recent'),
        value: 'date.recent',
      },
      {
        label: i18n.t('devtools:generators.json.types.birthdate'),
        value: 'date.birthdate',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.number'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.int'),
        value: 'number.int',
      },
      {
        label: i18n.t('devtools:generators.json.types.float'),
        value: 'number.float',
      },
      {
        label: i18n.t('devtools:generators.json.types.boolean'),
        value: 'datatype.boolean',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.phone'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.phoneNumber'),
        value: 'phone.number',
      },
      {
        label: i18n.t('devtools:generators.json.types.imei'),
        value: 'phone.imei',
      },
    ],
  },
  {
    category: i18n.t('devtools:generators.json.categories.image'),
    options: [
      {
        label: i18n.t('devtools:generators.json.types.avatar'),
        value: 'image.avatar',
      },
      {
        label: i18n.t('devtools:generators.json.types.imageUrl'),
        value: 'image.url',
      },
    ],
  },
]

function resolveFakerMethod(type: string, rowIndex: number): any {
  if (type === 'custom.rowNumber') {
    return rowIndex + 1
  }

  const [module, method] = type.split('.')

  try {
    const fakerModule = (faker as any)[module]
    if (fakerModule && typeof fakerModule[method] === 'function') {
      const result = fakerModule[method]()
      // Преобразуем даты в ISO строки
      if (result instanceof Date) {
        return result.toISOString()
      }
      return result
    }
  }
  catch {
    return null
  }

  return null
}

function addField() {
  fields.value.push({
    id: crypto.randomUUID(),
    name: '',
    type: 'person.firstName',
  })
}

function removeField(id: string) {
  const index = fields.value.findIndex(f => f.id === id)
  if (index > -1) {
    fields.value.splice(index, 1)
  }
}

function generate() {
  if (fields.value.length === 0) {
    output.value = ''
    return
  }

  const data = Array.from({ length: count.value }, (_, rowIndex) => {
    const obj: Record<string, any> = {}
    for (const field of fields.value) {
      if (field.name) {
        obj[field.name] = resolveFakerMethod(field.type, rowIndex)
      }
    }
    return obj
  })

  output.value = JSON.stringify(data, null, 2)
}

watch(count, (v) => {
  if (v > 1000) {
    nextTick(() => {
      count.value = 1000
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
        :title="i18n.t('devtools:generators.json.fields')"
        :level="3"
      />

      <div class="space-y-2">
        <draggable
          v-model="fields"
          item-key="id"
          handle=".drag-handle"
          :animation="200"
        >
          <template #item="{ element }">
            <div class="flex items-center gap-2 py-1">
              <div
                class="drag-handle cursor-grab text-gray-400 hover:text-gray-600"
              >
                <GripVertical class="h-4 w-4" />
              </div>
              <UiInput
                v-model="element.name"
                :placeholder="i18n.t('devtools:generators.json.fieldName')"
                class="flex-1"
              />
              <Select.Select v-model="element.type">
                <Select.SelectTrigger class="w-64">
                  <Select.SelectValue
                    :placeholder="i18n.t('devtools:generators.json.selectType')"
                  />
                </Select.SelectTrigger>
                <Select.SelectContent>
                  <template
                    v-for="group in fakerTypes"
                    :key="group.category"
                  >
                    <Select.SelectLabel>
                      {{ group.category }}
                    </Select.SelectLabel>
                    <Select.SelectItem
                      v-for="option in group.options"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </Select.SelectItem>
                    <Select.SelectSeparator />
                  </template>
                </Select.SelectContent>
              </Select.Select>
              <UiButton
                variant="icon"
                size="md"
                @click="removeField(element.id)"
              >
                <Trash2 class="h-3 w-3" />
              </UiButton>
            </div>
          </template>
        </draggable>

        <UiButton
          size="md"
          @click="addField"
        >
          <Plus class="mr-1 h-4 w-4" />
          {{ i18n.t("devtools:generators.json.addField") }}
        </UiButton>
      </div>
    </div>

    <div class="space-y-2">
      <UiHeading
        :title="i18n.t('devtools:generators.json.rowCount')"
        :level="3"
      />
      <UiInput
        v-model="count"
        type="number"
        :description="i18n.t('devtools:generators.json.maxRows')"
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
