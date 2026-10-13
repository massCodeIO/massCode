<script setup lang="ts">
import type { AiSemanticProvider } from '~/shared/aiSemantic'
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { AI_DEFAULT_URLS } from '~/shared/ai'
import { useAiSemanticSearch } from './useAiSemanticSearch'

const {
  status,
  busy,
  sources,
  models,
  refreshingModels,
  indexText,
  builtinErrorText,
  selectSource,
  selectProvider,
  refreshModels,
  downloadModel,
  cancelDownload,
  removeModel,
  retryIndex,
} = useAiSemanticSearch()

const servers: AiSemanticProvider['kind'][] = ['ollama', 'lmstudio']
const baseURL = ref('')
const manualModel = ref(false)
const modelDraft = ref('')

watch(
  () => status.value?.provider.baseURL,
  (value) => {
    baseURL.value = value ?? ''
  },
  { immediate: true },
)

function selectServer(value: unknown) {
  if (typeof value !== 'string' || value === status.value?.provider.kind)
    return
  const kind = value as AiSemanticProvider['kind']
  manualModel.value = false
  selectProvider({ kind, baseURL: AI_DEFAULT_URLS[kind], model: '' })
}

function saveBaseURL() {
  const value = baseURL.value.trim()
  if (value && value !== status.value?.provider.baseURL)
    selectProvider({ baseURL: value })
}

function selectModel(value: string) {
  if (value === '__manual__') {
    modelDraft.value = status.value?.provider.model ?? ''
    manualModel.value = true
    return
  }
  selectProvider({ model: value })
}

function saveManualModel() {
  const value = modelDraft.value.trim()
  if (!value)
    return
  selectProvider({ model: value })
  manualModel.value = false
}
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection
      :label="i18n.t('ai.semantic.title')"
      :description="i18n.t('ai.semantic.description')"
    >
      <UiMenuFormItem :label="i18n.t('ai.semantic.source')">
        <Select.Select
          :model-value="status?.source"
          :disabled="busy || !status"
          @update:model-value="selectSource"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="value in sources"
              :key="value"
              :value="value"
            >
              {{ i18n.t(`ai.semantic.sources.${value}`) }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>
      <UiMenuFormItem
        v-if="status?.source === 'builtin'"
        :label="i18n.t('ai.semantic.sources.builtin')"
      >
        <div class="flex min-h-9 flex-wrap items-center gap-2">
          <template v-if="status.builtin.state === 'downloading'">
            <UiText
              as="div"
              variant="base"
              muted
              class="flex items-center gap-2"
              role="status"
            >
              <LoaderCircle
                class="size-4 animate-spin"
                aria-hidden="true"
              />
              {{
                i18n.t("ai.semantic.builtin.downloading", {
                  percent: status.builtin.progress ?? 0,
                })
              }}
            </UiText>
            <Button
              variant="outline"
              :disabled="busy"
              @click="cancelDownload"
            >
              {{ i18n.t("button.cancel") }}
            </Button>
          </template>
          <template v-else-if="status.builtin.state === 'ready'">
            <UiStatus state="done">
              {{ i18n.t("ai.semantic.builtin.ready") }}
            </UiStatus>
            <Button
              variant="destructive"
              :disabled="busy"
              @click="removeModel"
            >
              {{ i18n.t("ai.semantic.builtin.remove") }}
            </Button>
          </template>
          <template v-else>
            <Button
              :disabled="busy"
              @click="downloadModel"
            >
              {{ i18n.t("ai.semantic.builtin.download") }}
            </Button>
            <UiStatus
              v-if="builtinErrorText"
              state="error"
            >
              {{ builtinErrorText }}
            </UiStatus>
          </template>
        </div>
      </UiMenuFormItem>
      <UiMenuFormItem
        v-else-if="status && !status.builtin.supported"
        :label="i18n.t('ai.semantic.sources.builtin')"
      >
        <UiText
          as="div"
          variant="base"
          muted
        >
          {{ i18n.t("ai.semantic.builtin.unsupported") }}
        </UiText>
      </UiMenuFormItem>
      <template v-if="status?.source === 'provider'">
        <UiMenuFormItem :label="i18n.t('ai.semantic.server')">
          <Select.Select
            :model-value="status.provider.kind"
            :disabled="busy"
            @update:model-value="selectServer"
          >
            <Select.SelectTrigger class="w-64">
              <Select.SelectValue />
            </Select.SelectTrigger>
            <Select.SelectContent>
              <Select.SelectItem
                v-for="value in servers"
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
            :disabled="busy"
            :aria-label="i18n.t('ai.baseURL')"
            @change="saveBaseURL"
          />
        </UiMenuFormItem>
        <UiMenuFormItem :label="i18n.t('ai.semantic.embeddingModel')">
          <div class="flex flex-wrap items-center gap-2">
            <template v-if="manualModel">
              <UiInput
                v-model="modelDraft"
                class="w-72 max-w-full"
                :disabled="busy"
                :placeholder="i18n.t('ai.modelPlaceholder')"
                :aria-label="i18n.t('ai.semantic.embeddingModel')"
                @keydown.enter="saveManualModel"
              />
              <Button
                :disabled="busy || !modelDraft.trim()"
                @click="saveManualModel"
              >
                {{ i18n.t("button.save") }}
              </Button>
              <Button
                variant="ghost"
                :disabled="busy"
                @click="manualModel = false"
              >
                {{ i18n.t("ai.chooseFromList") }}
              </Button>
            </template>
            <PreferencesAiModelSelect
              v-else
              :model-value="status.provider.model"
              :models="models"
              :disabled="busy"
              @select="selectModel"
            />
            <Button
              variant="outline"
              :disabled="busy || refreshingModels"
              :aria-busy="refreshingModels"
              @click="refreshModels()"
            >
              <LoaderCircle
                v-if="refreshingModels"
                class="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {{ i18n.t("ai.refreshModels") }}
            </Button>
          </div>
          <template #description>
            {{ i18n.t("ai.semantic.embeddingModelHint") }}
          </template>
        </UiMenuFormItem>
      </template>
      <UiMenuFormItem
        v-if="status && status.index.state !== 'off'"
        :label="i18n.t('ai.semantic.index')"
      >
        <div
          v-if="status.index.state === 'error'"
          class="flex items-center gap-2"
        >
          <UiStatus state="error">
            {{ i18n.t(`ai.errors.${status.index.error ?? "connection"}`) }}
          </UiStatus>
          <Button
            variant="outline"
            :disabled="busy"
            @click="retryIndex"
          >
            {{ i18n.t("ai.retry") }}
          </Button>
        </div>
        <UiText
          v-else
          as="div"
          variant="base"
          muted
          class="flex min-h-9 items-center gap-2"
        >
          <LoaderCircle
            v-if="status.index.state === 'indexing'"
            class="size-4 animate-spin"
            aria-hidden="true"
          />
          {{ indexText }}
        </UiText>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
