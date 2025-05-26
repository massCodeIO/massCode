<script setup lang="ts">
import { i18n } from '@/electron'
import { useClipboard } from '@vueuse/core'
import md5 from 'crypto-js/hmac-md5'
import ripemd160 from 'crypto-js/hmac-ripemd160'
import sha1 from 'crypto-js/hmac-sha1'
import sha3 from 'crypto-js/hmac-sha3'
import sha224 from 'crypto-js/hmac-sha224'
import sha256 from 'crypto-js/hmac-sha256'
import sha384 from 'crypto-js/hmac-sha384'
import sha512 from 'crypto-js/hmac-sha512'
import { Copy } from 'lucide-vue-next'

const { copy } = useClipboard()

const text = ref('')
const secretKey = ref('')

const title = computed(() => i18n.t('devtools:crypto.hmac.label'))
const description = computed(() => i18n.t('devtools:crypto.hmac.description'))

const hashTypes = {
  sha1: 'SHA-1',
  sha224: 'SHA-224',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
  sha3: 'SHA-3',
  md5: 'MD5',
  ripemd160: 'RIPEMD-160',
}

function convert(input: string, type: keyof typeof hashTypes): string {
  if (!input)
    return ''

  switch (type) {
    case 'sha1':
      return sha1(input, secretKey.value).toString()
    case 'sha224':
      return sha224(input, secretKey.value).toString()
    case 'sha256':
      return sha256(input, secretKey.value).toString()
    case 'sha384':
      return sha384(input, secretKey.value).toString()
    case 'sha512':
      return sha512(input, secretKey.value).toString()
    case 'sha3':
      return sha3(input, secretKey.value).toString()
    case 'md5':
      return md5(input, secretKey.value).toString()
    case 'ripemd160':
      return ripemd160(input, secretKey.value).toString()
  }
}

const output = computed(() => {
  return Object.entries(hashTypes).map(([key, value]) => ({
    label: value,
    value: convert(text.value, key as keyof typeof hashTypes),
  }))
})

function copyHash(type: keyof typeof hashTypes) {
  copy(convert(text.value, type))
}
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
        v-model="text"
        :placeholder="i18n.t('devtools:form.placeholder.text')"
        clearable
      />
      <UiHeading
        :title="i18n.t('devtools:form.secretKey')"
        :level="3"
      />
      <UiInput
        v-model="secretKey"
        :placeholder="i18n.t('devtools:form.placeholder.secretKey')"
        clearable
      />
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.output')"
        :level="3"
      />
      <div
        class="grid grid-cols-[max-content_1fr_max-content] items-center gap-4"
      >
        <template
          v-for="[type, label] in Object.entries(hashTypes)"
          :key="type"
        >
          <div class="text-text-secondary text-sm font-medium">
            {{ label }}
          </div>
          <UiInput
            :model-value="output.find((item) => item.label === label)?.value"
            readonly
          />
          <UiButton
            variant="icon"
            size="md"
            @click="copyHash(type as keyof typeof hashTypes)"
          >
            <Copy class="h-3 w-3" />
          </UiButton>
        </template>
      </div>
    </div>
  </div>
</template>
