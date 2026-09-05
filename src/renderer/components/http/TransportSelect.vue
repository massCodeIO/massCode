<script setup lang="ts">
import type { HttpMethod } from '~/main/types/http'
import * as Select from '@/components/ui/shadcn/select'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { i18n } from '@/electron'

const methods: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]
const { currentDraft } = useHttpRequests()
const selection = computed({
  get: () =>
    currentDraft.value?.protocol === 'websocket'
      ? 'websocket'
      : (currentDraft.value?.method ?? 'GET'),
  set: (value: string) => {
    const draft = currentDraft.value
    if (!draft)
      return
    if (value === 'websocket') {
      draft.protocol = 'websocket'
      if (!draft.url)
        draft.url = 'ws://'
    }
    else if (methods.includes(value as HttpMethod)) {
      draft.protocol = 'http'
      draft.method = value as HttpMethod
    }
  },
})
</script>

<template>
  <Select.Select v-model="selection">
    <Select.SelectTrigger
      class="w-24"
      :aria-label="i18n.t('spaces.http.websocket.requestType')"
    >
      <Select.SelectValue>
        <HttpMethodBadge
          :method="currentDraft?.method ?? 'GET'"
          :protocol="currentDraft?.protocol"
          size="sm"
        />
      </Select.SelectValue>
    </Select.SelectTrigger>
    <Select.SelectContent>
      <Select.SelectItem
        v-for="method in methods"
        :key="method"
        :value="method"
      >
        <HttpMethodBadge
          :method="method"
          size="sm"
        />
      </Select.SelectItem>
      <Select.SelectSeparator />
      <Select.SelectItem value="websocket">
        {{ i18n.t("spaces.http.websocket.title") }}
      </Select.SelectItem>
    </Select.SelectContent>
  </Select.Select>
</template>
