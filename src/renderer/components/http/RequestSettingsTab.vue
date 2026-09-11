<script setup lang="ts">
import type { HttpCookieSnapshot } from '~/shared/httpCookies'
import { Switch } from '@/components/ui/shadcn/switch'
import { useHttpRequests, useHttpSettings } from '@/composables'
import { useHttpCookieRevision } from '@/composables/spaces/http/devtools/useHttpCookieRevision'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n, ipc } from '@/electron'

import { HTTP_TRANSPORT_DEFAULTS } from '~/shared/httpTransport'

const { draft } = useHttpRuntime()
const { settings } = useHttpSettings()
const transport = computed({
  get: () => draft.value.transport ?? {},
  set: (value) => {
    if (Object.keys(value).length)
      draft.value.transport = value
    else delete draft.value.transport
  },
})
const defaults = computed(() => ({
  ...HTTP_TRANSPORT_DEFAULTS,
  ...settings.transport,
}))
const { currentRequest } = useHttpRequests()
const requestId = computed(() => currentRequest.value?.id ?? null)
const revision = useHttpCookieRevision()
const enabled = ref(true)
const loading = ref(true)
const saving = ref(false)
const error = ref('')

watch(
  [requestId, revision],
  async (_, __, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    loading.value = true
    error.value = ''
    try {
      const snapshot = (await ipc.invoke('spaces:http:cookies:read', {
        requestId: requestId.value,
      })) as HttpCookieSnapshot
      if (!cancelled)
        enabled.value = snapshot.enabled
    }
    catch {
      if (!cancelled)
        error.value = i18n.t('spaces.http.devtools.cookieError')
    }
    finally {
      if (!cancelled)
        loading.value = false
    }
  },
  { immediate: true },
)

async function setEnabled(value: boolean) {
  const id = requestId.value
  if (!id || saving.value || loading.value)
    return
  saving.value = true
  error.value = ''
  try {
    await ipc.invoke('spaces:http:cookies:setEnabled', {
      requestId: id,
      enabled: value,
    })
    if (requestId.value === id)
      enabled.value = value
  }
  catch {
    if (requestId.value === id)
      error.value = i18n.t('spaces.http.devtools.cookieError')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <HttpTransportSettings
      v-model="transport"
      :defaults="defaults"
    />
    <UiMenuFormSection :label="i18n.t('spaces.http.devtools.currentRequest')">
      <UiMenuFormItem :label="i18n.t('spaces.http.devtools.enableCookieJar')">
        <Switch
          :checked="enabled"
          :disabled="loading || saving || !requestId"
          :aria-label="i18n.t('spaces.http.devtools.enableCookieJar')"
          @update:checked="setEnabled"
        />
        <template #description>
          {{ i18n.t("spaces.http.devtools.cookieJarHint") }}
        </template>
      </UiMenuFormItem>
      <UiAlert
        v-if="error"
        variant="error"
      >
        {{ error }}
      </UiAlert>
    </UiMenuFormSection>
  </div>
</template>
