<script setup lang="ts">
import { Switch } from '@/components/ui/shadcn/switch'
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'

const includeNumbers = ref(true)
const includeSymbols = ref(true)
const includeUppercase = ref(true)
const includeLowercase = ref(true)
const length = ref(12)
const output = ref('')

const title = computed(() => i18n.t('devtools:crypto.password.label'))
const description = computed(() =>
  i18n.t('devtools:crypto.password.description'),
)

const { copy } = useClipboard()

function generatePassword() {
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'

  let availableChars = ''

  if (includeNumbers.value) {
    availableChars += numbers
  }

  if (includeSymbols.value) {
    availableChars += symbols
  }

  if (includeUppercase.value) {
    availableChars += uppercase
  }

  if (includeLowercase.value) {
    availableChars += lowercase
  }

  if (availableChars.length === 0) {
    output.value = ''
    return
  }

  let password = ''

  const requiredChars = []
  if (includeNumbers.value)
    requiredChars.push(numbers[Math.floor(Math.random() * numbers.length)])
  if (includeSymbols.value)
    requiredChars.push(symbols[Math.floor(Math.random() * symbols.length)])
  if (includeUppercase.value)
    requiredChars.push(uppercase[Math.floor(Math.random() * uppercase.length)])
  if (includeLowercase.value)
    requiredChars.push(lowercase[Math.floor(Math.random() * lowercase.length)])

  password += requiredChars.join('')

  for (let i = password.length; i < length.value; i++) {
    const randomIndex = Math.floor(Math.random() * availableChars.length)
    password += availableChars[randomIndex]
  }

  const passwordArray = password.split('')
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]]
  }

  output.value = passwordArray.join('')
}

watch(
  [includeNumbers, includeSymbols, includeUppercase, includeLowercase, length],
  () => {
    if (output.value) {
      generatePassword()
    }
  },
)

watch(length, (v) => {
  if (v > 2048) {
    nextTick(() => {
      length.value = 2048
    })
  }
})

onMounted(() => {
  generatePassword()
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
        :title="i18n.t('devtools:form.length')"
        :level="3"
      />
      <UiInput
        v-model.number="length"
        type="number"
        :placeholder="i18n.t('devtools:form.length')"
        description="Max 2048"
        class="w-64"
      />
      <div class="flex gap-2">
        <div class="flex items-center gap-2">
          <Switch
            :checked="includeNumbers"
            @update:checked="includeNumbers = $event"
          />
          {{ i18n.t("devtools:form.numbers") }}
        </div>
        <div class="flex items-center gap-2">
          <Switch
            :checked="includeSymbols"
            @update:checked="includeSymbols = $event"
          />
          {{ i18n.t("devtools:form.symbols") }}
        </div>
        <div class="flex items-center gap-2">
          <Switch
            :checked="includeUppercase"
            @update:checked="includeUppercase = $event"
          />
          {{ i18n.t("devtools:form.uppercase") }}
        </div>
        <div class="flex items-center gap-2">
          <Switch
            :checked="includeLowercase"
            @update:checked="includeLowercase = $event"
          />
          {{ i18n.t("devtools:form.lowercase") }}
        </div>
      </div>
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
      <div class="flex items-center gap-2">
        <UiButton
          size="md"
          @click="generatePassword()"
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
