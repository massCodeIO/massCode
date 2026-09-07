<script setup lang="ts">
import type { useHttpCollection } from '@/composables/spaces/http/useHttpCollection'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useSonner } from '@/composables/useSonner'
import { i18n } from '@/electron'
import { isMac } from '@/utils'
import { onKeyStroke } from '@vueuse/core'
import { LoaderCircle, Save } from 'lucide-vue-next'

const props = defineProps<{
  context?: Pick<
    ReturnType<typeof useHttpCollection>,
    | 'dirty'
    | 'saving'
    | 'save'
    | 'saveError'
    | 'unavailable'
    | 'leaveDialogOpen'
  >
}>()

const { currentRequest } = useHttpRequests()
const { sonner } = useSonner()
const {
  requestDirty,
  busy,
  saveRequest,
  requestSaveError,
  saveError,
  conflict,
  leaveDialogOpen,
} = props.context
  ? {
      requestDirty: props.context.dirty,
      busy: props.context.saving,
      saveRequest: props.context.save,
      requestSaveError: ref(false),
      saveError: props.context.saveError,
      conflict: ref(false),
      leaveDialogOpen: props.context.leaveDialogOpen,
    }
  : useHttpRuntime()
const unavailable = computed(() =>
  props.context
    ? props.context.unavailable.value
    : currentRequest.value?.runtimeState !== 'ready',
)

watch([requestSaveError, saveError], () => {
  if (requestSaveError.value || saveError.value) {
    sonner({
      type: 'error',
      message: i18n.t(
        conflict.value
          ? 'spaces.http.runtime.conflict'
          : 'spaces.http.runtime.saveError',
      ),
    })
  }
})

onKeyStroke(['s', 'S'], (event) => {
  if (
    (!event.metaKey && !event.ctrlKey)
    || event.altKey
    || event.shiftKey
    || leaveDialogOpen.value
  ) {
    return
  }
  event.preventDefault()
  if (!busy.value && !unavailable.value)
    void saveRequest()
})
</script>

<template>
  <UiActionButton
    class="relative shrink-0"
    :tooltip="`${i18n.t('button.save')} (${isMac ? '⌘S' : 'Ctrl+S'})`"
    :aria-label="i18n.t('button.save')"
    :disabled="busy || unavailable"
    aria-keyshortcuts="Meta+S Control+S"
    @click="saveRequest"
  >
    <LoaderCircle
      v-if="busy"
      class="animate-spin"
    />
    <Save v-else />
    <span
      v-if="requestDirty"
      class="bg-success absolute top-0.5 right-0.5 size-1.5 rounded-full"
      aria-hidden="true"
    />
    <span
      v-if="requestDirty"
      class="sr-only"
    >{{
      i18n.t("spaces.http.runtime.unsaved")
    }}</span>
  </UiActionButton>
</template>
