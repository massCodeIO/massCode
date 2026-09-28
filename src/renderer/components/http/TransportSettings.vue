<script setup lang="ts">
import type { HttpRequestItemResponse } from '@/services/api/generated'
import { FieldError } from '@/components/ui/shadcn/field'
import * as InputGroup from '@/components/ui/shadcn/input-group'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'
import { httpTransportSchema } from '~/shared/httpTransport'

type Transport = NonNullable<
  NonNullable<HttpRequestItemResponse['runtime']>['transport']
>
const props = defineProps<{ defaults: Transport, global?: boolean }>()
const model = defineModel<Transport>({ required: true })
const invalid = ref<Record<string, boolean>>({})
const numbers = ['timeoutMs', 'maxResponseBytes', 'maxRedirects'] as const
const booleans = computed(
  () =>
    [
      'encodeUrl',
      'followRedirects',
      'followOriginalHttpMethod',
      'followAuthorizationHeader',
      'removeRefererHeaderOnRedirect',
      ...(!props.global ? ['skipCertificateVerification' as const] : []),
    ] as const,
)
function setProtocol(value: unknown) {
  const next = { ...model.value }
  if (value === 'inherit')
    delete next.protocolVersion
  else if (value === 'http1' || value === 'http2' || value === 'auto')
    next.protocolVersion = value
  model.value = next
}

function setNumber(key: (typeof numbers)[number], value: string | number) {
  const next = { ...model.value }
  if (String(value).trim() === '')
    delete next[key]
  else
    next[key] = Number(value) * (key === 'maxResponseBytes' ? 1024 * 1024 : 1)
  invalid.value[key] = !httpTransportSchema.safeParse(next).success
  if (!invalid.value[key])
    model.value = next
}
function displayNumber(
  key: (typeof numbers)[number],
  value: number | undefined,
) {
  return value === undefined
    ? ''
    : String(key === 'maxResponseBytes' ? value / (1024 * 1024) : value)
}
function setBoolean(key: (typeof booleans.value)[number], value: unknown) {
  const next = { ...model.value }
  if (value === 'inherit')
    delete next[key]
  else next[key] = value === 'true'
  model.value = next
}
</script>

<template>
  <UiMenuFormSection :label="i18n.t('preferences:http.transport.label')">
    <UiMenuFormItem
      v-for="key in numbers"
      :key="key"
      :label="i18n.t(`preferences:http.transport.${key}`)"
    >
      <InputGroup.InputGroup class="h-7 w-48">
        <InputGroup.InputGroupInput
          :inputmode="key === 'maxResponseBytes' ? 'decimal' : 'numeric'"
          :aria-invalid="invalid[key] || undefined"
          :model-value="displayNumber(key, model[key])"
          :placeholder="displayNumber(key, defaults[key])"
          :aria-label="i18n.t(`preferences:http.transport.${key}`)"
          @update:model-value="setNumber(key, $event)"
        />
        <InputGroup.InputGroupAddon
          v-if="key !== 'maxRedirects'"
          align="inline-end"
        >
          <InputGroup.InputGroupText>
            {{
              i18n.t(
                key === "timeoutMs"
                  ? "preferences:http.transport.ms"
                  : "preferences:http.transport.mb",
              )
            }}
          </InputGroup.InputGroupText>
        </InputGroup.InputGroupAddon>
      </InputGroup.InputGroup>
      <FieldError v-if="invalid[key]">
        {{ i18n.t("preferences:http.transport.invalid") }}
      </FieldError>
      <template #description>
        {{ i18n.t(`preferences:http.transport.${key}Hint`) }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem
      :label="i18n.t('preferences:http.transport.protocolVersion')"
    >
      <Select.Select
        :model-value="model.protocolVersion ?? 'inherit'"
        @update:model-value="setProtocol"
      >
        <Select.SelectTrigger
          class="w-48"
          :aria-label="i18n.t('preferences:http.transport.protocolVersion')"
        >
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="value in ['inherit', 'auto', 'http1', 'http2']"
            :key="value"
            :value="value"
          >
            {{
              i18n.t(
                `preferences:http.transport.${value === "inherit" && global ? "legacy" : value}`,
              )
            }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
      <template #description>
        {{ i18n.t("preferences:http.transport.protocolVersionHint") }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem
      v-for="key in booleans"
      :key="key"
      :label="i18n.t(`preferences:http.transport.${key}`)"
    >
      <Select.Select
        :model-value="model[key] === undefined ? 'inherit' : String(model[key])"
        @update:model-value="setBoolean(key, $event)"
      >
        <Select.SelectTrigger
          class="w-48"
          :aria-label="i18n.t(`preferences:http.transport.${key}`)"
        >
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem value="inherit">
            {{
              i18n.t(
                global
                  ? "preferences:http.transport.legacy"
                  : "preferences:http.transport.inherit",
              )
            }}
          </Select.SelectItem>
          <Select.SelectItem value="true">
            {{ i18n.t("preferences:http.transport.on") }}
          </Select.SelectItem>
          <Select.SelectItem value="false">
            {{ i18n.t("preferences:http.transport.off") }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
      <template #description>
        {{ i18n.t(`preferences:http.transport.${key}Hint`) }}
      </template>
    </UiMenuFormItem>
    <slot />
  </UiMenuFormSection>
</template>
