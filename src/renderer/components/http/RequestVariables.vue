<script setup lang="ts">
import * as Select from '@/components/ui/shadcn/select'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { i18n } from '@/electron'
import { Plus, Trash2 } from 'lucide-vue-next'

const { currentRequest } = useHttpRequests()
const { draft, saving, removeExtraction } = useHttpRuntime()
const unavailable = computed(
  () => currentRequest.value?.runtimeState !== 'ready',
)
</script>

<template>
  <fieldset
    :disabled="unavailable || saving"
    class="space-y-3 disabled:opacity-50"
  >
    <UiText
      as="p"
      variant="xs"
      muted
    >
      {{ i18n.t("spaces.http.runtime.extractionHint") }}
    </UiText>
    <section class="space-y-1">
      <div class="flex items-center justify-between">
        <UiText variant="sm">
          {{ i18n.t("spaces.http.runtime.postResponse") }}
        </UiText>
        <UiActionButton
          :disabled="draft.extractions.length >= 100"
          :tooltip="i18n.t('spaces.http.runtime.addExtraction')"
          @click="
            draft.extractions.push({ name: '', source: 'json', path: '' })
          "
        >
          <Plus class="size-4" />
        </UiActionButton>
      </div>
      <div
        v-for="(rule, index) in draft.extractions"
        :key="index"
        class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 [&>div]:w-full [&>div]:min-w-0"
      >
        <HttpRuntimeInput
          v-model="rule.name"
          group="extractions"
          :index="index"
          field="name"
          :placeholder="i18n.t('spaces.http.runtime.variableName')"
          :label="i18n.t('spaces.http.runtime.variableName')"
        />
        <Select.Select
          v-model="rule.source"
          :disabled="unavailable || saving"
        >
          <Select.SelectTrigger
            class="h-7 w-full min-w-0"
            :aria-label="i18n.t('spaces.http.runtime.source')"
          >
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem value="json">
              {{ i18n.t("spaces.http.runtime.sources.json") }}
            </Select.SelectItem>
            <Select.SelectItem value="header">
              {{ i18n.t("spaces.http.runtime.sources.header") }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <HttpRuntimeInput
          v-model="rule.path"
          group="extractions"
          :index="index"
          field="path"
          :placeholder="
            i18n.t(
              rule.source === 'json'
                ? 'spaces.http.runtime.pointer'
                : 'spaces.http.runtime.header',
            )
          "
          :label="i18n.t('spaces.http.runtime.path')"
        />
        <UiActionButton
          :tooltip="i18n.t('spaces.http.runtime.remove')"
          @click="removeExtraction(index)"
        >
          <Trash2 class="size-4" />
        </UiActionButton>
      </div>
    </section>
  </fieldset>
</template>
