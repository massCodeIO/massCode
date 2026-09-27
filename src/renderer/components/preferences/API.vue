<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { Switch } from '@/components/ui/shadcn/switch'
import { useDialog } from '@/composables/useDialog'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc, store } from '@/electron'

interface ApiTokenGenerateResult {
  token: string
  tokenPreview: string
}

const apiPort = ref<number>(store.preferences.get('api.port') as number)
const integrationsEnabled = ref<boolean>(
  store.preferences.get('api.integrations.enabled') as boolean,
)
const tokenPreview = ref<string | null>(
  store.preferences.get('api.integrations.tokenPreview') as string | null,
)
const generatedToken = ref('')
const mcpEnabled = ref(store.preferences.get('api.mcp.enabled') === true)
const mcpEndpoint = computed(() => `http://127.0.0.1:${apiPort.value}/mcp`)
const { sonner } = useSonner()
const { confirm } = useDialog()
const hasToken = computed(() => !!(tokenPreview.value || generatedToken.value))
const isGeneratingToken = ref(false)

watch(apiPort, (value) => {
  const port = Number(value)
  if (port >= 1024 && port <= 65535) {
    store.preferences.set('api.port', port)
  }
})

watch(integrationsEnabled, (value) => {
  store.preferences.set('api.integrations.enabled', value)
})

watch(mcpEnabled, (value) => {
  store.preferences.set('api.mcp.enabled', value)
})

async function copyMcpEndpoint() {
  try {
    await navigator.clipboard.writeText(mcpEndpoint.value)
    sonner({ type: 'success', message: i18n.t('messages:success.copied') })
  }
  catch {
    sonner({ type: 'error', message: i18n.t('messages:error.copyFailed') })
  }
}

async function generateApiToken() {
  if (isGeneratingToken.value)
    return

  isGeneratingToken.value = true
  try {
    if (hasToken.value) {
      const confirmed = await confirm({
        title: i18n.t('preferences:api.integrations.token.replace'),
        content: i18n.t('preferences:api.integrations.token.replaceConfirm'),
        confirmText: i18n.t('preferences:api.integrations.token.replace'),
        confirmVariant: 'destructive',
      })
      if (!confirmed)
        return
    }

    const result = (await ipc.invoke(
      'system:api-token-generate',
      null,
    )) as ApiTokenGenerateResult

    integrationsEnabled.value = true
    tokenPreview.value = result.tokenPreview
    generatedToken.value = result.token
  }
  finally {
    isGeneratingToken.value = false
  }
}

async function revokeApiToken() {
  await ipc.invoke('system:api-token-revoke', null)

  integrationsEnabled.value = false
  tokenPreview.value = null
  generatedToken.value = ''
}

async function copyGeneratedToken() {
  if (!generatedToken.value) {
    return
  }

  await navigator.clipboard.writeText(generatedToken.value)
}
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:api.label')">
      <UiMenuFormItem :label="i18n.t('preferences:api.port.label')">
        <UiInput
          v-model="apiPort"
          type="number"
          min="1024"
          max="65535"
          size="sm"
          class="w-32"
        />
        <template #description>
          {{ i18n.t("preferences:api.port.description") }}
        </template>
        <template #actions>
          <Button
            variant="outline"
            @click="ipc.invoke('system:reload', null)"
          >
            {{ i18n.t("action.reload.app") }}
          </Button>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>

    <UiMenuFormSection :label="i18n.t('preferences:api.integrations.label')">
      <UiMenuFormItem
        :label="i18n.t('preferences:api.integrations.enabled.label')"
      >
        <Switch
          :checked="integrationsEnabled"
          @update:checked="integrationsEnabled = $event"
        />
        <template #description>
          {{ i18n.t("preferences:api.integrations.enabled.description") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem
        :label="i18n.t('preferences:api.integrations.token.label')"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UiInput
            :model-value="
              generatedToken
                || tokenPreview
                || i18n.t('preferences:api.integrations.token.empty')
            "
            readonly
            size="sm"
            class="w-72"
          />
          <Button
            :variant="hasToken ? 'outline' : 'default'"
            :disabled="isGeneratingToken"
            :aria-busy="isGeneratingToken"
            @click="generateApiToken"
          >
            {{
              hasToken
                ? i18n.t("preferences:api.integrations.token.replace")
                : i18n.t("preferences:api.integrations.token.generate")
            }}
          </Button>
          <Button
            v-if="generatedToken"
            variant="outline"
            @click="copyGeneratedToken"
          >
            {{ i18n.t("button.copy") }}
          </Button>
          <Button
            v-if="tokenPreview || generatedToken"
            variant="destructive"
            :disabled="isGeneratingToken"
            @click="revokeApiToken"
          >
            {{ i18n.t("preferences:api.integrations.token.revoke") }}
          </Button>
        </div>
        <template #description>
          {{ i18n.t("preferences:api.integrations.token.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
    <UiMenuFormSection :label="i18n.t('preferences:api.mcp.label')">
      <UiMenuFormItem :label="i18n.t('preferences:api.mcp.enabled.label')">
        <Switch
          :checked="mcpEnabled"
          @update:checked="mcpEnabled = $event"
        />
        <template #description>
          {{ i18n.t("preferences:api.mcp.enabled.description") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:api.mcp.endpoint.label')">
        <div class="flex flex-wrap items-center gap-2">
          <UiInput
            :model-value="mcpEndpoint"
            readonly
            size="sm"
            class="w-72"
          />
          <Button
            variant="outline"
            @click="copyMcpEndpoint"
          >
            {{ i18n.t("button.copy") }}
          </Button>
          <Button
            variant="outline"
            @click="
              ipc.invoke(
                'system:open-external',
                'https://masscode.io/documentation/mcp?ref=masscode-app',
              )
            "
          >
            {{ i18n.t("preferences:api.mcp.setup") }}
          </Button>
        </div>
        <template #description>
          {{ i18n.t("preferences:api.mcp.endpoint.description") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
