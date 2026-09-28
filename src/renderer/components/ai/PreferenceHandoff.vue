<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import {
  cancelPreferenceHandoff,
  preferenceFlowResult,
  preferenceHandoff,
} from '@/composables/ai/nativePreferenceFlows'
import { i18n } from '@/electron'
</script>

<template>
  <div
    v-if="preferenceHandoff"
    class="mb-4 space-y-2 rounded-md border p-3"
    role="status"
  >
    <UiText
      as="p"
      variant="sm"
    >
      {{ i18n.t(`ai.native.handoff.${preferenceHandoff.kind}`) }}
    </UiText>
    <UiText
      v-if="preferenceHandoff.partial?.persisted"
      as="p"
      variant="caption"
    >
      {{ i18n.t("ai.native.handoff.profileSaved") }}
    </UiText>
    <Button
      size="sm"
      variant="outline"
      :disabled="preferenceHandoff.cancelRequested"
      @click="cancelPreferenceHandoff()"
    >
      {{ i18n.t("ai.edit.cancel") }}
    </Button>
  </div>
  <AiNativeOutcome
    v-if="preferenceFlowResult"
    :result="preferenceFlowResult"
  />
</template>
