<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Select from '@/components/ui/shadcn/select'
import * as Tooltip from '@/components/ui/shadcn/tooltip'
import { useHttpExecute } from '@/composables/spaces/http/useHttpExecute'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpRuntime } from '@/composables/spaces/http/useHttpRuntime'
import { useHttpSession } from '@/composables/spaces/http/useHttpSession'
import { i18n } from '@/electron'
import { Plus, Trash2 } from 'lucide-vue-next'

const { currentRequest } = useHttpRequests()
const {
  draft,
  dirty,
  saving,
  saveError,
  conflict,
  saveRuntime,
  removeExtraction,
} = useHttpRuntime()
const { sessionNames, clearHttpSession, refreshHttpSessionNames }
  = useHttpSession()
const { resetHttpExecuteState } = useHttpExecute()
const unavailable = computed(
  () => currentRequest.value?.runtimeState !== 'ready',
)
const statusIsError = computed(() => unavailable.value || saveError.value)
const statusMessage = computed(() => {
  if (unavailable.value) {
    return i18n.t(
      `spaces.http.runtime.states.${currentRequest.value?.runtimeState ?? 'pending'}`,
    )
  }
  if (saveError.value) {
    return i18n.t(
      conflict.value
        ? 'spaces.http.runtime.conflict'
        : 'spaces.http.runtime.saveError',
    )
  }
  return i18n.t(
    dirty.value ? 'spaces.http.runtime.unsaved' : 'spaces.http.runtime.hint',
  )
})

async function clearSession() {
  resetHttpExecuteState()
  await clearHttpSession()
}

onMounted(() => {
  void refreshHttpSessionNames()
})
</script>

<template>
  <div class="space-y-3 pb-2">
    <div class="flex items-center justify-between gap-3">
      <div
        class="scrollbar h-8 min-w-0 flex-1 overflow-y-auto"
        role="status"
        aria-atomic="true"
      >
        <UiText
          v-if="statusIsError"
          as="p"
          variant="xs"
          class="text-destructive"
        >
          {{ statusMessage }}
        </UiText>
        <UiText
          v-else
          as="p"
          variant="xs"
          muted
        >
          {{ i18n.t("spaces.http.runtime.hint") }}
        </UiText>
      </div>
      <Tooltip.Tooltip>
        <Tooltip.TooltipTrigger as-child>
          <Button
            :disabled="unavailable || saving"
            @click="saveRuntime"
          >
            {{ i18n.t("spaces.http.runtime.save") }}
            <span
              v-if="dirty"
              class="bg-success size-1.5 shrink-0 rounded-full"
              aria-hidden="true"
            />
            <span
              v-if="dirty"
              class="sr-only"
            >{{
              i18n.t("spaces.http.runtime.unsaved")
            }}</span>
          </Button>
        </Tooltip.TooltipTrigger>
        <Tooltip.TooltipContent class="max-w-72">
          {{ statusMessage }}
        </Tooltip.TooltipContent>
      </Tooltip.Tooltip>
    </div>
    <fieldset
      :disabled="unavailable || saving"
      class="space-y-3 disabled:opacity-50"
    >
      <section class="space-y-1">
        <div class="flex items-center justify-between">
          <UiText variant="sm">
            {{ i18n.t("spaces.http.runtime.extractions") }}
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
      <HttpRequestAssertions :disabled="unavailable || saving" />
    </fieldset>
    <section class="border-border space-y-2 border-t pt-3">
      <div class="flex items-center justify-between">
        <UiText variant="sm">
          {{ i18n.t("spaces.http.runtime.session") }}
        </UiText>
        <Button
          variant="outline"
          @click="clearSession"
        >
          {{ i18n.t("spaces.http.runtime.clearSession") }}
        </Button>
      </div>
      <UiText
        as="p"
        variant="xs"
        muted
      >
        {{ i18n.t("spaces.http.runtime.sessionHint") }}
      </UiText>
      <UiText
        v-for="name in sessionNames"
        :key="name"
        variant="xs"
        class="font-mono"
      >
        {{ name }}: ••••••••
      </UiText>
    </section>
  </div>
</template>
