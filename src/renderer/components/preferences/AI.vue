<script setup lang="ts">
import type { AiProvider, AiResult, AiSettings } from '~/shared/ai'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { Textarea } from '@/components/ui/shadcn/textarea'
import { useAi } from '@/composables/ai/useAi'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc } from '@/electron'
import { AI_DEFAULT_URLS, AI_PROVIDERS, isLocalAiProvider } from '~/shared/ai'

const { settings, refreshSettings } = useAi()
const { sonner } = useSonner()
const cloudProviders = AI_PROVIDERS.filter(
  value => !isLocalAiProvider(value),
)
const localProviders = AI_PROVIDERS.filter(isLocalAiProvider)
const provider = ref<AiProvider>('openai')
const baseURL = ref(AI_DEFAULT_URLS.openai)
const model = ref('')
const userInstructions = ref('')
const apiKey = ref('')
const removeKey = ref(false)
const editingKey = ref(false)
const busy = ref(false)
const loaded = ref(false)
const currentProfile = computed(() => settings.value?.profiles[provider.value])
const sameEndpoint = computed(
  () =>
    baseURL.value.trim().replace(/\/+$/, '') === currentProfile.value?.baseURL,
)
const models = computed(() =>
  apiKey.value.trim() || removeKey.value || !sameEndpoint.value
    ? []
    : (currentProfile.value?.models ?? []),
)
const selectedModel = computed({
  get: () => (models.value.includes(model.value) ? model.value : ''),
  set: (value: string) => {
    model.value = value
  },
})
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
  editingKey.value = false
}
watch(provider, loadProfile)
async function saveAndCheck() {
  busy.value = true
  const savedProvider = provider.value
  try {
    const result = (await ipc.invoke('system:ai:configure', {
      provider: provider.value,
      baseURL: baseURL.value,
      model: model.value,
      userInstructions: userInstructions.value,
      ...(apiKey.value.trim()
        ? { apiKey: apiKey.value.trim() }
        : removeKey.value
          ? { apiKey: null }
          : {}),
    })) as AiResult<AiSettings>
    if (!result.ok) {
      sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
      return
    }
    settings.value = result.data
    baseURL.value = result.data.profiles[provider.value].baseURL
    apiKey.value = ''
    removeKey.value = false
    editingKey.value = false
    const modelsResult = (await ipc.invoke(
      'system:ai:models',
      null,
    )) as AiResult<string[]>
    if (!modelsResult.ok) {
      sonner({
        type: 'error',
        message: i18n.t(`ai.errors.${modelsResult.error}`),
      })
      return
    }
    if (settings.value)
      settings.value.profiles[savedProvider].models = modelsResult.data
    sonner({ type: 'success', message: i18n.t('ai.connected') })
  }
  catch {
    sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
  }
  finally {
    busy.value = false
  }
}
onMounted(async () => {
  try {
    const result = await refreshSettings()
    if (!result.ok) {
      sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
      return
    }
    userInstructions.value = result.data.userInstructions ?? ''
    provider.value = result.data.provider
    loadProfile()
    loaded.value = true
  }
  catch {
    sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
  }
})
onBeforeUnmount(() => {
  apiKey.value = ''
})
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('ai.title')">
      <UiMenuFormItem :label="i18n.t('ai.provider')">
        <Select.Select
          v-model="provider"
          :disabled="busy || !loaded"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectGroup>
              <Select.SelectLabel>
                {{ i18n.t("ai.cloudProviders") }}
              </Select.SelectLabel>
              <Select.SelectItem
                v-for="value in cloudProviders"
                :key="value"
                :value="value"
              >
                {{ i18n.t(`ai.providers.${value}`) }}
              </Select.SelectItem>
            </Select.SelectGroup>
            <Select.SelectSeparator />
            <Select.SelectGroup>
              <Select.SelectLabel>
                {{ i18n.t("ai.localProviders") }}
              </Select.SelectLabel>
              <Select.SelectItem
                v-for="value in localProviders"
                :key="value"
                :value="value"
              >
                {{ i18n.t(`ai.providers.${value}`) }}
              </Select.SelectItem>
            </Select.SelectGroup>
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
        <div class="flex flex-wrap items-center gap-2">
          <UiInput
            v-if="hasStoredKey && !editingKey"
            :model-value="currentProfile?.keyPreview ?? keyPlaceholder"
            readonly
            size="sm"
            class="w-72"
            :aria-label="i18n.t('ai.apiKey')"
          />
          <UiInput
            v-else
            v-model="apiKey"
            type="password"
            autocomplete="new-password"
            size="sm"
            class="w-72"
            :disabled="busy || !loaded || !settings?.encryptionAvailable"
            :placeholder="keyPlaceholder"
            :aria-label="i18n.t('ai.apiKey')"
          />
          <Button
            v-if="hasStoredKey && !editingKey"
            variant="outline"
            :disabled="busy || !loaded || !settings?.encryptionAvailable"
            @click="editingKey = true"
          >
            {{ i18n.t("ai.replaceKey") }}
          </Button>
          <Button
            v-if="editingKey"
            variant="outline"
            :disabled="busy"
            @click="
              editingKey = false;
              apiKey = '';
            "
          >
            {{ i18n.t("button.cancel") }}
          </Button>
          <Button
            v-if="hasStoredKey || apiKey"
            variant="destructive"
            :disabled="busy || !loaded"
            @click="
              removeKey = true;
              apiKey = '';
              editingKey = false;
            "
          >
            {{ i18n.t("ai.removeKey") }}
          </Button>
        </div>
        <template #description>
          {{ keyDescription }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.model')">
        <div class="flex flex-wrap items-center gap-2">
          <UiInput
            v-model="model"
            size="sm"
            class="w-72 max-w-full"
            :disabled="busy || !loaded"
            :placeholder="i18n.t('ai.modelPlaceholder')"
            :aria-label="i18n.t('ai.model')"
          />
          <Select.Select
            v-model="selectedModel"
            :disabled="busy || !loaded || !models.length"
          >
            <Select.SelectTrigger class="w-64 max-w-full">
              <Select.SelectValue
                :placeholder="
                  i18n.t(
                    models.length ? 'ai.chooseModel' : 'ai.modelsNotLoaded',
                  )
                "
              />
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
        </div>
        <template #description>
          {{ i18n.t("ai.modelHint") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('ai.userInstructions')">
        <Textarea
          v-model="userInstructions"
          :disabled="busy || !loaded"
          :maxlength="4000"
          :aria-label="i18n.t('ai.userInstructions')"
          :placeholder="i18n.t('ai.userInstructionsPlaceholder')"
          class="min-h-28 resize-y"
        />
        <template #description>
          {{ i18n.t("ai.userInstructionsHint") }}
        </template>
        <template #actions>
          <Button
            :disabled="busy || !loaded"
            :aria-busy="busy"
            @click="saveAndCheck"
          >
            {{ i18n.t(busy ? "ai.checking" : "ai.check") }}
          </Button>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
