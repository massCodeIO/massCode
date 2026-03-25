<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { Copy } from 'lucide-vue-next'

const inputRrl = ref('')

const title = computed(() => i18n.t('devtools:web.urlParser.label'))
const description = computed(() =>
  i18n.t('devtools:web.urlParser.description'),
)

const copy = useCopyToClipboard()

const url = computed(() => {
  let url: URL | null = null

  try {
    url = new URL(inputRrl.value)
  }
  catch {
    url = null
  }

  return url
})

const protocol = computed(() => url.value?.protocol)
const hash = computed(() => url.value?.hash)
const query = computed(() => url.value?.search)
const pathname = computed(() => url.value?.pathname)
const host = computed(() => url.value?.host)
const hostname = computed(() => url.value?.hostname)
const origin = computed(() => url.value?.origin)
const port = computed(() => url.value?.port)

const output = computed(() => {
  return {
    protocol: {
      label: 'Protocol',
      value: protocol.value,
    },
    hash: {
      label: 'Hash',
      value: hash.value,
    },
    query: {
      label: 'Query',
      value: query.value,
    },
    pathname: {
      label: 'Pathname',
      value: pathname.value,
    },
    host: {
      label: 'Host',
      value: host.value,
    },
    port: {
      label: 'Port',
      value: port.value,
    },
    hostname: {
      label: 'Hostname',
      value: hostname.value,
    },
    origin: {
      label: 'Origin',
      value: origin.value,
    },
  }
})

const queryStringKeyValue = computed(() => {
  if (!query.value)
    return []

  return query.value
    .slice(1)
    .split('&')
    .map((item) => {
      const [key, value] = item.split('=')
      return {
        key,
        value,
      }
    })
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
        :title="i18n.t('devtools:form.inputUrl')"
        :level="3"
      />
      <UiInput
        v-model="inputRrl"
        :placeholder="i18n.t('devtools:form.placeholder.url')"
        clearable
      />
    </div>
    <div class="space-y-4">
      <UiHeading
        :title="i18n.t('devtools:form.parsedUrl')"
        :level="3"
      />
      <div
        class="grid grid-cols-[max-content_1fr_max-content] items-center gap-4"
      >
        <template
          v-for="[key, value] in Object.entries(output)"
          :key="key"
        >
          <UiText
            as="div"
            weight="medium"
          >
            {{ value.label }}
          </UiText>
          <UiInput
            :model-value="value.value"
            readonly
          />
          <Button
            variant="icon"
            size="icon"
            @click="copy(value.value || '')"
          >
            <Copy />
          </Button>
        </template>
      </div>
      <UiHeading
        :title="i18n.t('devtools:form.splitQueryString')"
        :level="3"
      />
      <div
        class="grid grid-cols-[max-content_1fr_max-content] items-center gap-4"
      >
        <template
          v-for="item in queryStringKeyValue"
          :key="item.key"
        >
          <UiText
            as="div"
            weight="medium"
          >
            {{ item.key }}
          </UiText>
          <UiInput
            :model-value="item.value"
            readonly
          />
          <Button
            variant="icon"
            size="icon"
            @click="copy(item.value || '')"
          >
            <Copy />
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>
