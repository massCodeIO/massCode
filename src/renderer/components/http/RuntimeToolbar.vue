<script setup lang="ts">
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { i18n } from '@/electron'

withDefaults(defineProps<{ showHint?: boolean }>(), { showHint: true })
const { currentRequest } = useHttpRequests()
const unavailable = computed(
  () => currentRequest.value?.runtimeState !== 'ready',
)
</script>

<template>
  <UiAlert
    v-if="unavailable"
    :variant="currentRequest?.runtimeState === 'pending' ? 'warning' : 'error'"
    class="mb-3"
  >
    {{
      i18n.t(
        `spaces.http.runtime.states.${currentRequest?.runtimeState ?? "pending"}`,
      )
    }}
  </UiAlert>
  <UiText
    v-else-if="showHint"
    as="p"
    variant="xs"
    muted
    class="mb-3"
  >
    {{ i18n.t("spaces.http.runtime.hint") }}
  </UiText>
</template>
