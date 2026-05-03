<script setup lang="ts">
import type { HttpRequestDraft } from '@/composables'
import type { HttpAuthType } from '~/main/types/http'
import { Input } from '@/components/ui/shadcn/input'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'

const draft = defineModel<HttpRequestDraft>({ required: true })

const AUTH_TYPES: { value: HttpAuthType, labelKey: string }[] = [
  { value: 'none', labelKey: 'spaces.http.editor.auth.typeNone' },
  { value: 'bearer', labelKey: 'spaces.http.editor.auth.typeBearer' },
  { value: 'basic', labelKey: 'spaces.http.editor.auth.typeBasic' },
]

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
            v-for="t in AUTH_TYPES"
            :key="t.value"
            :value="t.value"
          >
            {{ i18n.t(t.labelKey) }}
          </Select.SelectItem>
        </Select.SelectContent>
      </Select.Select>
    </div>

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
