<script setup lang="ts">
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useEditableField } from '@/composables/useEditableField'
import { i18n } from '@/electron'
import {
  getEntryNameConflictMessage,
  getEntryNameValidationMessage,
} from '@/utils'
import { useDebounceFn } from '@vueuse/core'
import { getEntryNameValidationIssue } from '~/shared/entryNameValidation'

const { currentRequest, hasSiblingRequestNameConflict, updateHttpRequest }
  = useHttpRequests()
const { isFocusedRequestName } = useHttpApp()
const focused = ref(false)
let pending: { id: number, name: string } | null = null
let saving = Promise.resolve()

const saveDebounced = useDebounceFn(flushName, 500)
const {
  model: name,
  onFocus,
  onBlur,
  reset: resetName,
} = useEditableField(
  () => currentRequest.value?.name,
  (value) => {
    const request = currentRequest.value
    if (
      !request
      || request.pendingCloudDownload
      || getEntryNameValidationIssue(value)
    ) {
      return
    }
    if (hasSiblingRequestNameConflict(value, request.id, request.folderId))
      return
    pending = { id: request.id, name: value }
    void saveDebounced()
  },
)
// Flush the captured owner before switching requests; serialize writes so an
// older name cannot overwrite a newer one when API responses arrive slowly.
function flushName() {
  const update = pending
  pending = null
  if (!update)
    return
  saving = saving.then(async () => {
    const saved = await updateHttpRequest(update.id, { name: update.name })
    if (
      !saved
      && currentRequest.value?.id === update.id
      && name.value === update.name
    ) {
      resetName()
    }
  })
}
const validationMessage = computed(() => {
  const issue = getEntryNameValidationMessage(name.value, i18n.t.bind(i18n))
  if (issue)
    return issue
  const request = currentRequest.value
  return request
    && hasSiblingRequestNameConflict(name.value, request.id, request.folderId)
    ? getEntryNameConflictMessage('request', i18n.t.bind(i18n))
    : ''
})
function focusName() {
  focused.value = true
  onFocus()
}
function blurName() {
  flushName()
  if (validationMessage.value)
    resetName()
  focused.value = false
  isFocusedRequestName.value = false
  onBlur()
}
watch(
  () => currentRequest.value?.id,
  () => {
    flushName()
    focused.value = false
    onBlur()
    resetName()
  },
  { flush: 'sync' },
)
onBeforeUnmount(flushName)
</script>

<template>
  <UiInputValidationTooltip
    :open="focused && Boolean(validationMessage)"
    :message="validationMessage"
  >
    <UiInput
      v-model="name"
      variant="ghost"
      class="w-full truncate px-0"
      :placeholder="i18n.t('spaces.http.editor.namePlaceholder')"
      :data-planned-title="`http-request:${currentRequest?.id}`"
      :select="isFocusedRequestName"
      @focus="focusName"
      @blur="blurName"
    />
  </UiInputValidationTooltip>
</template>
