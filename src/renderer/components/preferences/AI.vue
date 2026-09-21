<script setup lang="ts">
import type { AiProvider, AiResult, AiSettings } from '~/shared/ai'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { useAi } from '@/composables/ai/useAi'
import { i18n, ipc } from '@/electron'
import { AI_DEFAULT_URLS, AI_PROVIDERS, isLocalAiProvider } from '~/shared/ai'

const { settings, refreshSettings } = useAi()
const provider = ref<AiProvider>('openai')
const baseURL = ref(AI_DEFAULT_URLS.openai)
const model = ref('')
const apiKey = ref('')
const removeKey = ref(false)
const models = ref<string[]>([])
const busy = ref(false)
const status = ref('')
const error = ref('')
const loaded = ref(false)
const currentProfile = computed(() => settings.value?.profiles[provider.value])
const sameEndpoint = computed(
  () =>
    baseURL.value.trim().replace(/\/+$/, '') === currentProfile.value?.baseURL,
)
const hasKey = computed(
  () => currentProfile.value?.hasKey && !removeKey.value && sameEndpoint.value,
)
const hasStoredKey = computed(
  () =>
    currentProfile.value?.hasStoredKey
    && !removeKey.value
    && sameEndpoint.value,
)
const keyPlaceholder = computed(() => {
  if (hasKey.value)
    return i18n.t('ai.keySaved')
  if (hasStoredKey.value)
    return i18n.t('ai.keyUnreadable')
  return i18n.t(
    !isLocalAiProvider(provider.value) ? 'ai.keyRequired' : 'ai.keyPlaceholder',
  )
})
const keyDescription = computed(() => {
  if (removeKey.value)
    return i18n.t('ai.keyWillRemove')
  return i18n.t(
    settings.value?.encryptionAvailable
      ? 'ai.keyHint'
      : 'ai.errors.encryptionUnavailable',
  )
})
function loadProfile() {
  const profile = settings.value?.profiles[provider.value]
  baseURL.value = profile?.baseURL ?? AI_DEFAULT_URLS[provider.value]
  model.value = profile?.model ?? ''
  apiKey.value = ''
  removeKey.value = false
  models.value = []
  status.value = ''
  error.value = ''
}
watch(provider, loadProfile)
watch([baseURL, model, apiKey], () => {
  status.value = ''
})
async function save(check = false) {
  busy.value = true
  error.value = ''
  status.value = ''
  try {
    const result = (await ipc.invoke('system:ai:configure', {
      provider: provider.value,
      baseURL: baseURL.value,
      model: model.value,
      ...(apiKey.value.trim()
        ? { apiKey: apiKey.value.trim() }
        : removeKey.value
          ? { apiKey: null }
          : {}),
    })) as AiResult<AiSettings>
    if (!result.ok) {
      error.value = result.error
      return
    }
    settings.value = result.data
    baseURL.value = result.data.profiles[provider.value].baseURL
    apiKey.value = ''
    removeKey.value = false
    status.value = 'saved'
    if (check) {
      const result = (await ipc.invoke('system:ai:models', null)) as AiResult<
        string[]
      >
      if (!result.ok) {
        error.value = result.error
        status.value = ''
        return
      }
      models.value = result.data
      status.value = 'connected'
    }
  }
  catch {
    error.value = 'connection'
  }
  finally {
    busy.value = false
  }
}
onMounted(async () => {
  try {
    const result = await refreshSettings()
    if (!result.ok) {
      error.value = result.error
      return
    }
    provider.value = result.data.provider
    loadProfile()
    loaded.value = true
  }
  catch {
    error.value = 'connection'
  }
})
onBeforeUnmount(() => {
  apiKey.value = ''
})
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection
      :label="i18n.t('ai.title')"
      :description="i18n.t('ai.settingsHint')"
    >
      <UiMenuFormItem :label="i18n.t('ai.provider')">
        <Select.Select
          v-model="provider"
          :disabled="busy || !loaded"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="value in AI_PROVIDERS"
              :key="value"
              :value="value"
            >
              {{ i18n.t(`ai.providers.${value}`) }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.baseURL')">
        <UiInput
          v-model="baseURL"
          :disabled="busy || !loaded || !isLocalAiProvider(provider)"
          :aria-label="i18n.t('ai.baseURL')"
        />
        <template #description>
          {{
            i18n.t(
              !isLocalAiProvider(provider) ? "ai.cloudHint" : "ai.localHint",
            )
          }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.apiKey')">
        <UiInput
          v-model="apiKey"
          type="password"
          autocomplete="new-password"
          :disabled="busy || !loaded || !settings?.encryptionAvailable"
          :placeholder="keyPlaceholder"
          :aria-label="i18n.t('ai.apiKey')"
        />
        <template #description>
          {{ keyDescription }}
        </template>
        <template #actions>
          <Button
            variant="outline"
            :disabled="busy || !loaded || (!hasStoredKey && !apiKey)"
            @click="
              removeKey = true;
              apiKey = '';
            "
          >
            {{ i18n.t("ai.removeKey") }}
          </Button>
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.model')">
        <UiInput
          v-model="model"
          :disabled="busy || !loaded"
          :placeholder="i18n.t('ai.modelPlaceholder')"
          :aria-label="i18n.t('ai.model')"
        />
        <Select.Select
          v-if="models.length"
          v-model="model"
          :disabled="busy"
        >
          <Select.SelectTrigger class="mt-2">
            <Select.SelectValue :placeholder="i18n.t('ai.chooseModel')" />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="id in models"
              :key="id"
              :value="id"
            >
              {{ id }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("ai.modelHint") }}
        </template>
        <template #actions>
          <div class="space-y-2">
            <div class="flex gap-2">
              <Button
                :disabled="busy || !loaded"
                @click="save()"
              >
                {{ i18n.t("ai.save") }}
              </Button>
              <Button
                variant="outline"
                :disabled="busy || !loaded"
                @click="save(true)"
              >
                {{ i18n.t("ai.check") }}
              </Button>
            </div>
            <UiText
              v-if="busy"
              as="p"
              variant="sm"
              role="status"
            >
              {{ i18n.t("ai.checking") }}
            </UiText>
            <UiText
              v-if="status"
              as="p"
              variant="sm"
              role="status"
            >
              {{ i18n.t(`ai.${status}`) }}
            </UiText>
            <UiText
              v-if="error"
              as="p"
              variant="sm"
              class="text-destructive"
              role="alert"
            >
              {{ i18n.t(`ai.errors.${error}`) }}
            </UiText>
          </div>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
