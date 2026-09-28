<script setup lang="ts">
import type { AiHttpRequestPreview } from '~/shared/aiHttpActions'
import { i18n } from '@/electron'

defineProps<{ request: AiHttpRequestPreview }>()
</script>

<template>
  <div class="space-y-1">
    <UiText
      as="p"
      variant="sm"
      weight="medium"
    >
      {{ request.method }} {{ request.name }}
    </UiText>
    <UiText
      as="p"
      variant="sm"
      class="break-all select-text"
    >
      {{ request.url }}
    </UiText>
    <UiText
      as="p"
      variant="caption"
      muted
    >
      {{ i18n.t("ai.httpActions.environment") }}:
      {{ request.environmentName ?? i18n.t("ai.httpActions.noEnvironment") }}
    </UiText>
    <UiText
      as="p"
      variant="caption"
      muted
    >
      {{
        i18n.t("ai.httpActions.requestSummary", {
          body: request.bodyType,
          characters: request.bodyCharacters,
          fields: request.formEntries,
          headers: request.headers,
          auth: request.authType,
        })
      }}
    </UiText>
    <UiText
      as="p"
      variant="caption"
      muted
    >
      {{
        i18n.t("ai.httpActions.transportSummary", {
          timeout: request.transport.timeoutMs,
          redirects: request.transport.maxRedirects,
          protocol: request.transport.protocolVersion,
        })
      }}
    </UiText>
    <UiText
      v-if="request.transport.skipCertificateVerification"
      as="p"
      variant="caption"
    >
      {{ i18n.t("ai.httpActions.skipCertificateVerification") }}
    </UiText>
    <UiText
      v-if="request.scripts.length"
      as="p"
      variant="caption"
    >
      {{ i18n.t("ai.httpActions.scriptsMayChangeRequest") }}
    </UiText>
    <UiText
      v-for="script in request.scripts"
      :key="`${script.source}:${script.id}`"
      as="p"
      variant="caption"
    >
      {{ i18n.t(`ai.httpActions.scriptSources.${script.source}`) }} ·
      {{ script.id }} ·
      {{
        i18n.t(
          script.trusted
            ? "ai.httpActions.scriptsTrusted"
            : "ai.httpActions.scriptsUntrusted",
        )
      }}
    </UiText>
  </div>
</template>
