<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { useAiSemanticSearch } from './useAiSemanticSearch'

const {
  status,
  busy,
  sources,
  indexText,
  builtinErrorText,
  selectSource,
  downloadModel,
  cancelDownload,
  removeModel,
  retryIndex,
} = useAiSemanticSearch()
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection
      :label="i18n.t('ai.semantic.title')"
      :description="i18n.t('ai.semantic.description')"
    >
      <UiMenuFormItem
        v-if="status && !status.builtin.supported"
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
      <UiMenuFormItem
        v-else
        :label="i18n.t('ai.semantic.source')"
      >
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
