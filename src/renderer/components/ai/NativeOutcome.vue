<script setup lang="ts">
import type { AiNativeResult } from '~/shared/aiNativeActions'
import { i18n } from '@/electron'

defineProps<{ result: Omit<AiNativeResult, 'id'> }>()
</script>

<template>
  <div
    class="space-y-1"
    role="status"
  >
    <UiText
      as="p"
      variant="caption"
    >
      {{ i18n.t(`ai.native.${result.status}`) }}
    </UiText>
    <UiText
      v-if="result.reloadRequested"
      as="p"
      variant="caption"
    >
      {{ i18n.t("ai.native.reloadRequested") }}
    </UiText>
    <template v-if="result.storage">
      <UiText
        v-for="(value, key) in result.storage"
        :key="key"
        as="p"
        variant="caption"
      >
        {{ i18n.t(`ai.native.storageResult.${key}`) }}:
        {{
          typeof value === "boolean"
            ? i18n.t(value ? "ai.native.yes" : "ai.native.no")
            : value
        }}
      </UiText>
    </template>
    <template v-if="result.profile">
      <UiText
        as="p"
        variant="caption"
      >
        {{ result.profile.provider }} · {{ result.profile.model || "—" }}
      </UiText>
      <UiText
        as="p"
        variant="caption"
      >
        {{ i18n.t("ai.native.profileSaved") }}:
        {{ i18n.t(result.profile.saved ? "ai.native.yes" : "ai.native.no") }}
      </UiText>
      <UiText
        as="p"
        variant="caption"
      >
        {{
          i18n.t(`ai.native.connectionCheck.${result.profile.connectionCheck}`)
        }}
      </UiText>
    </template>
  </div>
</template>
