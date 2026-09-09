<script setup lang="ts">
import type { HttpAuth, HttpAuthType } from '~/main/types/http'
import { Input } from '@/components/ui/shadcn/input'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'

const props = withDefaults(defineProps<{ allowInherit?: boolean }>(), {
  allowInherit: true,
})

const draft = defineModel<{
  auth: HttpAuth
}>({ required: true })

const AUTH_TYPES: { value: HttpAuthType, labelKey: string }[] = [
  { value: 'none', labelKey: 'spaces.http.editor.auth.typeNone' },
  { value: 'bearer', labelKey: 'spaces.http.editor.auth.typeBearer' },
  { value: 'apikey', labelKey: 'spaces.http.editor.auth.typeApiKey' },
  { value: 'basic', labelKey: 'spaces.http.editor.auth.typeBasic' },
]

const authTypes = computed(() =>
  props.allowInherit
    ? [
        {
          value: 'inherit' as const,
          labelKey: 'spaces.http.editor.auth.typeInherit',
        },
        ...AUTH_TYPES,
      ]
    : AUTH_TYPES,
)

const authType = computed({
  get: () => draft.value.auth.type,
  set: (value) => {
    draft.value.auth = { ...draft.value.auth, type: value }
  },
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center">
      <Select.Select v-model="authType">
        <Select.SelectTrigger class="w-48">
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem
            v-for="t in authTypes"
            :key="t.value"
            :value="t.value"
          >
            {{ i18n.t(t.labelKey) }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </div>

    <UiText
      v-if="authType !== 'none' && authType !== 'inherit'"
      class="text-muted-foreground text-xs"
    >
      {{ i18n.t("spaces.http.editor.auth.plainTextHint") }}
    </UiText>

    <div
      v-if="authType === 'bearer'"
      class="flex flex-col gap-1"
    >
      <UiText class="text-muted-foreground text-xs">
        {{ i18n.t("spaces.http.editor.auth.token") }}
      </UiText>
      <Input
        v-model="draft.auth.token"
        class="font-mono"
        :placeholder="i18n.t('spaces.http.editor.auth.tokenPlaceholder')"
      />
    </div>

    <div
      v-else-if="authType === 'apikey'"
      class="flex flex-col gap-3"
    >
      <Input
        v-model="draft.auth.key"
        :placeholder="i18n.t('spaces.http.editor.keyValue.key')"
      />
      <Input
        v-model="draft.auth.value"
        type="password"
        :placeholder="i18n.t('spaces.http.editor.keyValue.value')"
      />
      <Select.Select
        :model-value="draft.auth.in ?? 'header'"
        @update:model-value="draft.auth.in = $event as 'header' | 'query'"
      >
        <Select.SelectTrigger class="w-48">
          <Select.SelectValue />
        </Select.SelectTrigger>
        <Select.SelectContent>
          <Select.SelectItem value="header">
            {{ i18n.t("spaces.http.editor.auth.apiKeyHeader") }}
          </Select.SelectItem>
          <Select.SelectItem value="query">
            {{ i18n.t("spaces.http.editor.auth.apiKeyQuery") }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </div>
    <div
      v-else-if="authType === 'basic'"
      class="flex flex-col gap-3"
    >
      <div class="flex flex-col gap-1">
        <UiText class="text-muted-foreground text-xs">
          {{ i18n.t("spaces.http.editor.auth.username") }}
        </UiText>
        <Input
          v-model="draft.auth.username"
          class="font-mono"
          :placeholder="i18n.t('spaces.http.editor.auth.usernamePlaceholder')"
        />
      </div>
      <div class="flex flex-col gap-1">
        <UiText class="text-muted-foreground text-xs">
          {{ i18n.t("spaces.http.editor.auth.password") }}
        </UiText>
        <Input
          v-model="draft.auth.password"
          type="password"
          class="font-mono"
          :placeholder="i18n.t('spaces.http.editor.auth.passwordPlaceholder')"
        />
      </div>
    </div>
  </div>
</template>
