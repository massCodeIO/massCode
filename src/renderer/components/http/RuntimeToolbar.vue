<script setup lang="ts">
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n } from '@/electron'

withDefaults(defineProps<{ showHint?: boolean }>(), { showHint: true })
const { currentRequest } = useHttpRequests()
const { saveError, conflict } = useHttpRuntime()
const unavailable = computed(
  () => currentRequest.value?.runtimeState !== 'ready',
)
const error = computed(() => {
  if (unavailable.value) {
    return i18n.t(
      `spaces.http.runtime.states.${currentRequest.value?.runtimeState ?? 'pending'}`,
    )
  }
  if (saveError.value) {
    return i18n.t(
      conflict.value
        ? 'spaces.http.runtime.conflict'
        : 'spaces.http.runtime.saveError',
    )
  }
  return ''
})
</script>

<template>
  <UiText
    v-if="error || showHint"
    as="p"
    variant="xs"
    muted
    class="mb-3"
    :class="{ 'text-destructive': error }"
    role="status"
  >
    {{ error || i18n.t("spaces.http.runtime.hint") }}
  </UiText>
</template>
